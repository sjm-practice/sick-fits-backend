const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');

require("dotenv").config({ path: "variables.env" });
const createServer = require("./createServer");
const db = require("./db");

const server = createServer();

// Use express middleware to handle cookies (JWT)
server.express.use(cookieParser());

// Use express middleware to populate current user
server.express.use((req, res, next) => {
  const {token}  = req.cookies;
  if (token) {
    const userId = jwt.verify(token, process.env.APP_SECRET);
    // put userId on to the request for future requests to access
    req.userId = userId;
  }
});

server.start(
  {
    cors: {
      credentials: true,
      origin: process.env.FRONTEND_URL,
    },
  },
  deets => console.log(`Server is now running at http://localhost:${deets.port}`)
);
