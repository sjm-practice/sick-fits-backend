const { forwardTo } = require("prisma-binding");

const Query = {
  // when simply passing a request on to the database (not doing any checks prior to),
  // can use forwardTo, and do not need to write the explicit code below
  items: forwardTo('db'),
  item: forwardTo('db'),
  itemsConnection: forwardTo('db'),
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
      info
    );
  }
};

module.exports = Query;
