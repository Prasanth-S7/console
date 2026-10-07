import type { Request, Response } from 'express';
import { Router } from 'express';
import { runSchema } from '../types/index.js';

export const run: Router = Router();

run.post('/', async (req: Request, res: Response) => {
    try {
        const parsedResponse = runSchema.safeParse(req.body);
        if(!parsedResponse.success) {
            return res.status(401).json({
                msg: "Bad request body"
            })
        }
        // const { playbookId, arguments } = parsedResponse.data

        // console.log(playbookId, arguments)
    }

    catch(error){
        return res.status(500).json({
            msg: "Internal Server Error"
        })
    }
})

