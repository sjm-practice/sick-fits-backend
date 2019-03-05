const { forwardTo } = require("prisma-binding");
const { hasPermission } = require("../utils");

const Query = {
  // when simply passing a request on to the database (not doing any checks prior to),
  // can use forwardTo, and do not need to write the explicit code below
  items: forwardTo("db"),
  item: forwardTo("db"),
  itemsConnection: forwardTo("db"),
  me(parent, args, ctx, info) {
    // check if there is a current user
    const { userId } = ctx.request;
    if (!userId) {
      return null;
    }
    return ctx.db.query.user(
      {
        where: { id: userId },
      },
      info,
    );
  },
  async users(parent, args, ctx, info) {
    // 1. check if logged in
    if (!ctx.request.userId) {
      throw new Error("You must be logged in!");
    }

    // 2. check if has permission to query all users
    hasPermission(ctx.request.user, ["ADMIN", "PERMISSIONUPDATE"]);

    // 3. query all users
    return ctx.db.query.users({}, info);
  },
};

module.exports = Query;
