module.exports = require("stripe")(process.env.STRIPE_SECRET);

// above line is the shorter version of
// const stripe = require("stripe");
// const config = stripe(process.env.STRIPE_SECRET);
// module.exports = config;

//
// Also, keeping the stripe require in a separate file here,
// makes it more convenient to import in to more than one file
// if needed (instead of repeating the above line over and over)
//
