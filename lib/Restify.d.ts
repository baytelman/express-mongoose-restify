import { Request, Response, Router } from 'express';
import { RequestHandler } from 'express-serve-static-core';
import { Model } from 'mongoose';
export declare const listModel: (model: Model<any>) => (req: Request, res: Response) => Promise<void>;
export declare const getModel: (model: Model<any>) => (req: Request, res: Response) => Promise<void>;
export declare const deleteModel: (model: Model<any>) => (req: Request, res: Response) => Promise<void>;
export declare const postModel: (model: Model<any>) => (req: Request, res: Response) => Promise<void>;
export declare const putModel: (model: Model<any>) => (req: Request, res: Response) => Promise<void>;
export declare const restifyModel: (router: Router, model: Model<any>, { preprocesor, methods }: {
    preprocesor?: RequestHandler;
    methods?: {
        get?: boolean;
        list?: boolean;
        post?: boolean;
        put?: boolean;
        delete?: boolean;
    };
}) => void;
