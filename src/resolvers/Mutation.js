const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { randomBytes } = require("crypto");
const { promisify } = require("util");
const { transport, emailTemplate } = require("../mail");
const { hasPermission } = require("../utils");
const stripe = require("../stripe");

const Mutations = {
  async createItem(parent, args, ctx, info) {
    // check if user logged in
    if (!ctx.request.userId) {
      throw new Error("You must be logged in to create an item to sell!");
    }

    const item = await ctx.db.mutation.createItem(
      {
        data: {
          // Prisma: create a relationship between item and user
          user: {
            connect: {
              id: ctx.request.userId,
            },
          },
          ...args,
        },
      },
      info,
    );

    return item;
  },
  updateItem(parent, args, ctx, info) {
    // TODO: check if user logged in

    // first make a copy of the updates
    const updates = { ...args };
    // then remove id (don't want to update that)
    delete updates.id;

    return ctx.db.mutation.updateItem(
      {
        data: updates,
        where: {
          id: args.id,
        },
      },
      info,
    );
  },
  async deleteItem(parent, args, ctx, info) {
    const where = { id: args.id };
    // 1. find the item to delete
    const item = await ctx.db.query.item(
      { where },
      `{
        id
        title
        user {
          id
        }
      }`,
    );
    // 2. check if owner, and has permissions
    const ownsItem = item.user.id === ctx.request.userId;
    const hasPermissions = ctx.request.user.permissions.some(permission =>
      ["ADMIN", "ITEMDELETE"].includes(permission),
    );
    if (!ownsItem && !hasPermissions) {
      throw new Error("You do not have permission to delete this item.");
    }

    // 3. delete it
    return ctx.db.mutation.deleteItem({ where }, info);
  },
  async signup(parent, args, ctx, info) {
    // lowercase the email
    args.email = args.email.toLowerCase();
    // hash the password
    const password = await bcrypt.hash(args.password, 10);
    // create the user in the db
    const user = await ctx.db.mutation.createUser(
      {
        data: {
          ...args,
          password,
          permissions: { set: ["USER"] },
        },
      },
      info,
    );
    // create a jwt token for the new user
    const token = jwt.sign({ userId: user.id }, process.env.APP_SECRET);
    // set the jwt token on the response
    ctx.response.cookie("token", token, {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 365, // 1 year
    });

    // return user to browser
    return user;
  },
  async signin(parent, { email, password }, ctx, info) {
    // 1. check if there is a user with that email
    const user = await ctx.db.query.user({ where: { email } });
    if (!user) {
      throw new Error(`No such user for email ${email}.`);
    }

    // 2. check if their password is correct
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      throw new Error("Invalid password.");
    }

    // 3. generate the JWT token
    const token = jwt.sign({ userId: user.id }, process.env.APP_SECRET);

    // 4. set the cookie with the token
    ctx.response.cookie("token", token, {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 365, // 1 year
    });

    // 5. return the user
    return user;
  },
  signout(parent, args, ctx, info) {
    ctx.response.clearCookie("token");
    return { message: "Goodbye!" };
  },
  async requestReset(parent, { email }, ctx, info) {
    // 1. check if this is a real user
    const user = await ctx.db.query.user({ where: { email } });
    if (!user) {
      throw new Error(`No such user for email ${email}.`);
    }

    // 2. set a reset token and expiry on that user
    const randomBytesPromise = promisify(randomBytes);
    const resetToken = (await randomBytesPromise(20)).toString("hex");
    const resetTokenExpiry = Date.now() + 3600000; // 1 hr from now
    const res = await ctx.db.mutation.updateUser({
      where: { email },
      data: { resetToken, resetTokenExpiry },
    });

    // 3. email them that reset token
    const mailRes = await transport.sendMail({
      from: "dev@sickfits.com",
      to: user.email,
      subject: "Sick Fits! Reset your password.",
      html: emailTemplate(`Your Password Reset Token is here!
      \n\n
      <a href="${
        process.env.FRONTEND_URL
      }/reset?resetToken=${resetToken}">Click here to reset.</a>
      `),
    });

    return { message: "reset token generated" };
  },
  async resetPassword(parent, { resetToken, password, confirmPassword }, ctx, info) {
    // 1. check passwords match
    if (password !== confirmPassword) {
      throw new Error("Password and Confirm Password do not matchMedia.");
    }

    // 2. check legit token
    // 3. check if expired
    const [user] = await ctx.db.query.users({
      where: {
        resetToken,
        resetTokenExpiry_gte: Date.now() - 3600000,
      },
    });
    if (!user) {
      throw new Error("Reset Password request is either invalid or expired.");
    }

    // 4. hash new password
    const newPassword = await bcrypt.hash(password, 10);

    // 5. save new password, remove old resetToken fields
    const updatedUser = await ctx.db.mutation.updateUser({
      where: { email: user.email },
      data: {
        password: newPassword,
        resetToken: null,
        resetTokenExpiry: null,
      },
    });

    // 6. generate JWT
    const token = jwt.sign({ userId: updatedUser.id }, process.env.APP_SECRET);

    // 7. set JWT cookie
    ctx.response.cookie("token", token, {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 365, // 1 yr
    });

    // 8. return the new user
    return updatedUser;
  },
  async updatePermissions(parent, args, ctx, info) {
    // 1. check if logged in
    if (!ctx.request.userId) {
      throw new Error("You must be logged in!");
    }

    // 2. check if has permission to query all users
    hasPermission(ctx.request.user, ["ADMIN", "PERMISSIONUPDATE"]);

    // 3. update the permissions
    return ctx.db.mutation.updateUser(
      {
        where: {
          id: args.userId,
        },
        data: {
          permissions: {
            set: args.permissions,
          },
        },
      },
      info,
    );
  },
  async addToCart(parent, args, ctx, info) {
    // 1. Make sure user logged in
    const { userId } = ctx.request;
    if (!userId) {
      throw new Error("You must be signed in to add items to the cart.");
    }

    // 2. Query user's current cart
    const [existingCartItem] = await ctx.db.query.cartItems({
      where: {
        user: { id: userId },
        item: { id: args.id },
      },
    });

    // 3. if item in cart, increment by 1
    if (existingCartItem) {
      return ctx.db.mutation.updateCartItem(
        {
          where: { id: existingCartItem.id },
          data: { quantity: existingCartItem.quantity + 1 },
        },
        info,
      );
    }

    // 4. if item not in cart, create CartItem
    return ctx.db.mutation.createCartItem(
      {
        data: {
          user: {
            connect: { id: userId },
          },
          item: {
            connect: { id: args.id },
          },
        },
      },
      info,
    );
  },
  async removeFromCart(parent, args, ctx, info) {
    // 1. find cart item
    const cartItem = await ctx.db.query.cartItem(
      {
        where: {
          id: args.id,
        },
      },
      `{ id, user { id }}`,
    );
    if (!cartItem) throw new Error("No cart item found.");

    // 2. make sure they own cart item
    if (cartItem.user.id !== ctx.request.userId) {
      throw new Error("You must be the owner of the item to delete from cart.");
    }

    // 3. delete cart item
    return ctx.db.mutation.deleteCartItem(
      {
        where: { id: args.id },
      },
      info,
    );
  },
  async createOrder(parent, args, ctx, info) {
    // 1. make sure user signed in
    const { userId } = ctx.request;
    if (!userId) throw new Error("You must be logged in to comlete this order.");

    const user = await ctx.db.query.user(
      { where: { id: userId } },
      `{
        id
        name
        email
        cart {
          id
          quantity
          item { id title price description image largeImage }
        }
      }`,
    );

    // 2. recalculate total price (server side is true source)
    const amount = user.cart.reduce(
      (tally, cartItem) => tally + cartItem.item.price * cartItem.quantity,
      0,
    );

    // 3. create the stripe charge (turn token into $$$)
    const charge = await stripe.charges.create({
      amount,
      currency: "USD",
      source: args.token,
    });

    // 4. convert (copy) CartItems to OrderItems
    const orderItems = user.cart.map(cartItem => {
      const orderItem = {
        ...cartItem.item,
        quantity: cartItem.quantity,
        user: { connect: { id: userId } },
      };
      delete orderItem.id;
      return orderItem;
    });

    // 5. create the order
    const order = ctx.db.mutation.createOrder({
      data: {
        total: charge.amount,
        charge: charge.id,
        items: { create: orderItems },
        user: { connect: { id: userId } },
      },
    });

    // 6. clear the users cart (delete cartItems)
    const cartItemIds = user.cart.map(cartItem => cartItem.id);
    await ctx.db.mutation.deleteManyCartItems({
      where: {
        id_in: cartItemIds,
      },
    });

    // 7. return the order to the client
    return order;
  },
};

module.exports = Mutations;
