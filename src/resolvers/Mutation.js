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
      data: {
        ...updates
      },
      where: {
        id: args.id
      }
    }, info);
  }
};

module.exports = Mutations;
