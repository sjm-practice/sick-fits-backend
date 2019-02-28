const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { randomBytes } = require("crypto");
const { promisify } = require("util");

const Mutations = {
  async createItem(parent, args, ctx, info) {
    // TODO: check if user logged in
    
    const item = await ctx.db.mutation.createItem({
      data: {
        ...args
      }
    }, info);

    return item;
  },
  updateItem(parent, args, ctx, info) {
    // TODO: check if user logged in
    
    // first make a copy of the updates
    const updates = {...args};
    // then remove id (don't want to update that)
    delete updates.id;
    
    return ctx.db.mutation.updateItem({
      data: updates,
      where: {
        id: args.id
      }
    }, info);
  },
  async deleteItem(parent, args, ctx, info) {
    const where = { id: args.id };
    // 1. find the item to delete
    const item = await ctx.db.query.item({where}, `{ id
    title}`);
    // 2. check if owner, and has permissions
    // TODO
    // 3. delete it
    return ctx.db.mutation.deleteItem({where}, info);
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
          permissions: { set: ['USER']}
        }
      },
      info
    );
    // create a jwt token for the new user
    const token = jwt.sign({userId: user.id}, process.env.APP_SECRET);
    // set the jwt token on the response
    ctx.response.cookie('token', token, {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 365, // 1 year
    });

    // return user to browser
    return user;
  },
  async signin(parent, {email, password}, ctx, info) {
    // 1. check if there is a user with that email
    const user = await ctx.db.query.user({ where: { email }});
    if (!user) {
      throw new Error(`No such user for email ${email}.`);
    }

    // 2. check if their password is correct
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      throw new Error("Invalid password.");
    }

    // 3. generate the JWT token
    const token = jwt.sign({userId: user.id}, process.env.APP_SECRET);
    
    // 4. set the cookie with the token
    ctx.response.cookie('token', token, {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 365, // 1 year
    });
    
    // 5. return the user
    return user;
  },
  signout(parent, args, ctx, info) {
    ctx.response.clearCookie('token');
    return { message: "Goodbye!" };
  },
  async requestReset(parent, { email }, ctx, info) {
    // 1. check if this is a real user
    const user = await ctx.db.query.user({ where: { email }});
    if (!user) {
      throw new Error(`No such user for email ${email}.`);
    }

    // 2. set a reset token and expiry on that user
    const randomBytesPromise = promisify(randomBytes); 
    const resetToken = (await randomBytesPromise(20)).toString('hex');
    const resetTokenExpiry = Date.now() + 3600000; // 1 hr from now
    const res = await ctx.db.mutation.updateUser({
      where: {email},
      data: { resetToken, resetTokenExpiry},
    })

    // TODO 3. email them that reset token

    return { message: 'reset token generated' };
  },
  async resetPassword(parent, { resetToken, password, confirmPassword }, ctx, info) {
    // 1. check passwords match
    if (password !==  confirmPassword) {
      throw new Error("Password and Confirm Password do not matchMedia.")
    }

    // 2. check legit token
    // 3. check if expired
    const [user] = await ctx.db.query.users({
      where: {
        resetToken,
        resetTokenExpiry_gte: Date.now() - 3600000,
      }
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
      }
    });

    // 6. generate JWT
    const token = jwt.sign({ userId: updatedUser.id }, process.env.APP_SECRET);

    // 7. set JWT cookie
    ctx.response.cookie("token", token, {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 365  // 1 yr
    });

    // 8. return the new user
    return updatedUser;
  }
};

module.exports = Mutations;
