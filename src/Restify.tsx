import { Request, Response, Router } from 'express';
import { RequestHandler } from 'express-serve-static-core';
import { Document, Model, Types } from 'mongoose';

const IGNORE_PROPS_EDIT = ['createdAt', 'updatedAt', 'id', '_id'];

const preprocess = async (obj: any, preprocessor?: PreprocessorType) => {
  IGNORE_PROPS_EDIT.forEach(prop => delete obj[prop]);
  if (preprocessor) {
    return await preprocessor(obj);
  }
  return obj;
};
const postprocess = async (obj: any, postprocessor?: PostprocessorType) => {
  IGNORE_PROPS_EDIT.forEach(prop => delete obj[prop]);
  if (postprocessor) {
    return await postprocessor(obj);
  }
  return obj;
};

const convertModelToRest = (model: Model<any>, instance: Document, options?: ModelOptions) => {
  const object = instance.toObject();
  if (options && options.primaryKey) {
      object.id = object[options.primaryKey];
      object[options.primaryKey] = undefined;
  } else {
      object.id = object._id;
  }
  object._id = undefined;
  object.__v = undefined;
  return object;
};

export const listModel = (model: Model<any>, options?: ModelOptions, postprocessor?: PostprocessorType) => async (
  req: Request,
  res: Response
) => {
  const { filter, range, sort } = req.query;
  const conditions: any = {};
  if (filter) {
    const search = JSON.parse(filter);
    const { q } = search;
    if (q) {
      /* Search for case-insensitive match on any field: */
      const schema: any = model.schema;
      const combinedOr = Object.keys(schema.paths)
        .filter(
          k =>
            schema.paths[k].instance === 'String' ||
            schema.paths[k].instance === 'ObjectID' ||
            schema.paths[k].instance === 'Number'
        )
        .map(k => {
          switch (schema.paths[k].instance) {
            case 'String':
              return {
                [k]: new RegExp(q, 'i')
              };
            case 'ObjectID':
              return Types.ObjectId.isValid(q)
                ? {
                    [k]: q
                  }
                : null;
            case 'Number':
              return !isNaN(parseInt(q))
                ? {
                    [k]: parseInt(q)
                  }
                : null;
          }
          return null;
        })
        .filter(condition => !!condition);
      if (combinedOr.length > 0) {
        conditions['$or'] = combinedOr;
      }
    } else {
      const combinedAnd = Object.keys(search).map(key => {
        const isId = key === 'id';
        const needle = search[key];
        if (Array.isArray(needle)) {
          return {
            [isId ? '_id' : key]: { $in: needle.map(n => (isId ? Types.ObjectId(n) : n)) }
          };
        }
        return { [isId ? '_id' : key]: isId ? Types.ObjectId(needle) : needle };
      });
      if (combinedAnd.length > 0) {
        conditions['$and'] = combinedAnd;
      }
    }
  }
  const count = await model.count(conditions);
  let query = model.find(conditions);
  if (options.populate) {
    query = query.populate(options.populate);
  }
  if (sort) {
    const [field, order] = JSON.parse(sort);
    query = query.sort({
      [options && options.primaryKey && field === 'id' ? options.primaryKey : field]: order === 'ASC' ? 1 : -1
    });
  }
  if (range) {
    const [start, end] = JSON.parse(range);
    query = query.skip(start).limit(end - start);
  }
  const all = await Promise.all(
    (await query).map(async c => convertModelToRest(model, await postprocess(c, postprocessor), options))
  );
  res.header('Content-Range', `${model.collection.name} 0-${all.length - 1}/${count}`).json(all);
};

const matchCondition = (keyword: string, options?: MatchOptions) => {
  const condition =
    options && options.match
      ? {
          $or: [
            ...(options && options.primaryKey ? [options.primaryKey] : Types.ObjectId.isValid(keyword) ? ['_id'] : []),
            ...options.match
          ].map(field => ({
            [field]: keyword
          }))
        }
      : {
          [(options && options.primaryKey) || '_id']:
            (((options && options.primaryKey) || Types.ObjectId.isValid(keyword)) && keyword) || null
        };
  return condition;
};

export const getModel = (model: Model<any>, options?: MatchOptions, postprocessor?: PostprocessorType) => async (
  req: Request,
  res: Response
) => {
  const id = req.params.id;
  let query = model.findOne(matchCondition(id, options));
  if (options.populate) {
    query = query.populate(options.populate);
  }
  const obj = convertModelToRest(model, await postprocess(await query), options);
  res.json(obj);
};

export const deleteModel = (model: Model<any>, options?: MatchOptions) => async (req: Request, res: Response) => {
  const id = req.params.id;
  const obj = await model.findOneAndDelete(matchCondition(id, options));
  res.json(convertModelToRest(model, obj, options));
};

export const postModel = (
  model: Model<any>,
  { primaryKey, preprocessor }: { primaryKey?: string; preprocessor?: PreprocessorType }
) => async (req: Request, res: Response) => {
  let { body } = req;
  body = await preprocess(body, preprocessor);
  const instance = new model(body);
  await instance.save();
  res.json(convertModelToRest(model, instance, { primaryKey }));
};

export const putModel = (model: Model<any>, { options }: { options?: MatchAndProcessorOptions }) => async (
  req: Request,
  res: Response
) => {
  const id = req.params.id;
  let {
    body: { id: _, ...body }
  } = req;
  body = await preprocess(body, options && options.preprocessor);
  try {
    const instance = await model.findOneAndUpdate(
      matchCondition(id, options),
      {
        $set: body
      },
      { new: true }
    );
    res.json(convertModelToRest(model, instance, options));
  } catch (error) {
    console.log({ error });
    throw error;
  }
};

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

type PreprocessorType = (object: any) => Promise<any>;
type PostprocessorType = (object: any) => Promise<any>;

interface RestifyOptions extends MatchOptions {
  primaryKey?: string;
  requestHandler?: RequestHandler;
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

export const restifyModel = (
  router: Router,
  model: Model<any>,
  { primaryKey, populate, requestHandler, methods, match, preprocessor, postprocessor }: RestifyOptions
) => {
  // List
  if (!methods || methods.list) {
    if (requestHandler) {
      router.route('/').get(requestHandler, listModel(model, { primaryKey, populate }, postprocessor));
    } else {
      router.route('/').get(listModel(model, { primaryKey, populate }, postprocessor));
    }
  }

  // Create one
  if (!methods || methods.post) {
    if (requestHandler) {
      router.route('/').post(requestHandler, postModel(model, { primaryKey, preprocessor }));
    } else {
      router.route('/').post(postModel(model, { primaryKey, preprocessor }));
    }
  }

  // Fetch one
  if (!methods || methods.get) {
    if (requestHandler) {
      router.route('/:id').get(requestHandler, getModel(model, { primaryKey, populate, match }, postprocessor));
    } else {
      router.route('/:id').get(getModel(model, { primaryKey, populate, match }, postprocessor));
    }
  }

  // Update one
  if (!methods || methods.put) {
    if (requestHandler) {
      router.route('/:id').put(requestHandler, putModel(model, { options: { primaryKey, match, preprocessor } }));
      router.route('/:id').patch(requestHandler, putModel(model, { options: { primaryKey, match, preprocessor } }));
    } else {
      router.route('/:id').put(putModel(model, { options: { primaryKey, match, preprocessor } }));
      router.route('/:id').patch(putModel(model, { options: { primaryKey, match, preprocessor } }));
    }
  }

  // Delete one
  if (!methods || methods.delete) {
    if (requestHandler) {
      router.route('/:id').delete(requestHandler, deleteModel(model, { primaryKey, match }));
    } else {
      router.route('/:id').delete(deleteModel(model, { primaryKey, match }));
    }
  }
};
