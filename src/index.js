const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");

require("dotenv").config({ path: "variables.env" });
const createServer = require("./createServer");
const db = require("./db");

const server = createServer();

// Use express middleware to handle cookies (JWT)
server.express.use(cookieParser());

// Use express middleware to populate current userId
server.express.use((req, res, next) => {
  const { token } = req.cookies;
  if (token) {
    const { userId } = jwt.verify(token, process.env.APP_SECRET);
    // put userId on to the request for future requests to access
    req.userId = userId;
  }
  next();
});

// Use express middleware to populate current user
server.express.use(async (req, res, next) => {
  // if no user logged in, skip this
  if (!req.userId) return next();

  // get the user from db
  const user = await db.query.user(
    { where: { id: req.userId } },
    `{ id, permissions, name, email }`,
  );

  // add user to request
  req.user = user;

  return next();
});

server.start(
  {
    cors: {
      credentials: true,
      origin: process.env.FRONTEND_URL,
    },
  },
  deets => console.log(`Server is now running at http://localhost:${deets.port}`),
);
