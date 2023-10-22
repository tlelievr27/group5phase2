//Middleware are functions that are automatically run before the request actually is handled by the API endpoint
//Its useful for things like authentication, input validation, etc.

import { Request, Response, NextFunction } from 'express';

function verifyAuthToken(req: Request, res: Response, next: NextFunction) {
    const authToken = req.headers.authorization;


    if (!authToken) {
        return res.status(400).json({ error: 'Authorization token is missing' });
    }
    else {
        console.log(authToken)
    }

    // Here you would verify the validity of the token, for example by decoding it and checking its expiration date
    // If the token is invalid, you would return a 400 Unauthorized response



    next();
}

export default verifyAuthToken;
