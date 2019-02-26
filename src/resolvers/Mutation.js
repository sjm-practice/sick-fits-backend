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
  }
};

module.exports = Mutations;
