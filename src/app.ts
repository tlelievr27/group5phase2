import dotenv from "dotenv";
dotenv.config();

//Some of our imports need the environment variables to be already defined

import express from 'express';
import api_router from './routes/api_routes';
import verifyAuthToken from './middleware/token_auth';
import logger from "./utils/logger"; //Get logger in this main file

//MAIN FILE

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '5mb'}));
app.use(verifyAuthToken); //Tells it to check the token auth function before passing the request to the endpoint
app.use(api_router); //Tells it to use the routes defined in the router in our api_routes.ts file

app.listen(PORT, () => {
    logger.info(`Server is running on port ${PORT}`);
  });