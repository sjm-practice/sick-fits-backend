const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

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
  }
};

module.exports = Mutations;
