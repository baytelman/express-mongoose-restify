import { Request, Response, Router } from 'express';
import { RequestHandler } from 'express-serve-static-core';
import { Model, Types } from 'mongoose';

const IGNORE_PROPS_EDIT = ['createdAt', 'updatedAt', 'id', '_id'];

const preprocess = (obj: any, preprocessor?: PreprocessorType) => {
  IGNORE_PROPS_EDIT.forEach(prop => delete obj[prop]);
  if (preprocessor) {
    return preprocessor(obj);
  }
  return obj;
};
const convertModelToRest = (model: Model<any>, obj: any, options: PrimaryKeyOptions) => {
  const schema: any = model.schema;
  return (
    obj &&
    Object.keys(schema.paths).reduce(
      (map: any, key: string) => {
        if (key !== options.primaryKey) {
          map[key] = obj[key];
        }
        return map;
      },
      { id: obj[options.primaryKey || 'id'] }
    )
  );
};

export const listModel = (model: Model<any>, options?: PrimaryKeyOptions) => async (req: Request, res: Response) => {
  const { filter, range, sort } = req.query;
  const count = await model.count({});
  const conditions: any = {};
  if (filter) {
    const { q } = JSON.parse(filter);
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
        })
        .filter(condition => !!condition);
      if (combinedOr.length > 0) {
        conditions['$or'] = combinedOr;
      }
    }
  }
  let query = model.find(conditions);
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
  const all = (await query).map(c => convertModelToRest(model, c, options));
  res.header('Content-Range', `${model.name} 0-${all.length - 1}/${count}`).json(all);
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

export const getModel = (model: Model<any>, options?: MatchOptions) => async (req: Request, res: Response) => {
  const id = req.params.id;
  const obj = convertModelToRest(model, await model.findOne(matchCondition(id, options)), options);
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
  body = preprocess(body, preprocessor);
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
  body = preprocess(body, options.preprocessor);
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

interface PrimaryKeyOptions {
  primaryKey?: string;
}

interface MatchOptions extends PrimaryKeyOptions {
  match?: string[];
}

interface MatchAndProcessorOptions extends MatchOptions {
  preprocessor?: PreprocessorType;
}

type PreprocessorType = (object: any) => any;

interface RestifyOptions extends MatchOptions {
  primaryKey?: string;
  requestHandler?: RequestHandler;
  preprocessor?: PreprocessorType;
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
  { primaryKey, requestHandler, methods, match, preprocessor }: RestifyOptions
) => {
  // List
  if (!methods || methods.list) {
    if (requestHandler) {
      router.route('/').get(requestHandler, listModel(model, { primaryKey }));
    } else {
      router.route('/').get(listModel(model, { primaryKey }));
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
      router.route('/:id').get(requestHandler, getModel(model, { primaryKey, match }));
    } else {
      router.route('/:id').get(getModel(model, { primaryKey, match }));
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
