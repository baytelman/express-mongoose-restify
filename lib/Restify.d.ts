import { Request, Response, Router } from 'express';
import { Model } from 'mongoose';
export declare const listModel: (model: Model<any>, options?: ModelOptions, postprocessor?: PostprocessorType) => (req: Request, res: Response) => Promise<void>;
export declare const getModel: (model: Model<any>, options?: MatchOptions, postprocessor?: PostprocessorType) => (req: Request, res: Response) => Promise<void>;
export declare const deleteModel: (model: Model<any>, options?: MatchOptions) => (req: Request, res: Response) => Promise<void>;
export declare const postModel: (model: Model<any>, { primaryKey, preprocessor }: {
    primaryKey?: string;
    preprocessor?: PreprocessorType;
}) => (req: Request, res: Response) => Promise<void>;
export declare const putModel: (model: Model<any>, { options }: {
    options?: MatchAndProcessorOptions;
}) => (req: Request, res: Response) => Promise<void>;
interface ModelOptions {
    primaryKey?: string;
    populate?: any;
}
interface MatchOptions extends ModelOptions {
    match?: string[];
}
interface MatchAndProcessorOptions extends MatchOptions {
    preprocessor?: PreprocessorType;
}
declare type PreprocessorType = (object: any) => Promise<any>;
declare type PostprocessorType = (object: any) => Promise<any>;
interface RestifyOptions extends MatchOptions {
    primaryKey?: string;
    requestHandler?: any;
    preprocessor?: PreprocessorType;
    postprocessor?: PostprocessorType;
    methods?: {
        get?: boolean;
        list?: boolean;
        post?: boolean;
        put?: boolean;
        delete?: boolean;
    };
}
export declare const restifyModel: (router: Router, model: Model<any>, { primaryKey, populate, requestHandler, methods, match, preprocessor, postprocessor }: RestifyOptions) => void;
export {};
