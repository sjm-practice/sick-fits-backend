const { forwardTo } = require("prisma-binding");

const Query = {
  items: forwardTo('db'),
  item: forwardTo('db'),
  itemsConnection: forwardTo('db'),
  // when simply passing a request on to the database (not doing any checks prior to),
  // can use forwardTo, and do not need to write the explicit code below
  //
  // async items(parent, args, ctx, info) {
  //   const items = await ctx.db.query.items();

  //   return items;
  // }
};

module.exports = Query;
