import { Request, Response, Router } from 'express';
import { RequestHandler } from 'express-serve-static-core';
import { Model } from 'mongoose';

const IGNORE_PROPS_EDIT = ['createdAt', 'updatedAt', 'id', '_id'];
const removeReadOnlyProps = (obj: any) => IGNORE_PROPS_EDIT.forEach(prop => delete obj[prop]);
const preprocess = (obj: any, preprocessor?: PreprocessorType) => {
  const propsWithoutReadOnly = removeReadOnlyProps(obj);
  if (preprocessor) {
    return preprocessor(propsWithoutReadOnly);
  }
  return propsWithoutReadOnly;
};
const convertModelToRest = (model: Model<any>, obj: any) => {
  const schema: any = model.schema;
  return (
    obj &&
    Object.keys(schema.paths).reduce(
      (map: any, key: string) => {
        map[key] = obj[key];
        return map;
      },
      { id: obj.id }
    )
  );
};

export const listModel = (model: Model<any>) => async (req: Request, res: Response) => {
  const { filter, range, sort } = req.query;
  const count = await model.count({});
  const conditions: any = {};
  if (filter) {
    const { q } = JSON.parse(filter);
    if (q) {
      /* Search for case-insensitive match on any field: */
      conditions['$or'] = Object.keys(model.schema.obj).map(k => ({
        [k]: new RegExp(q, 'i')
      }));
    }
  }
  let query = model.find(conditions);
  if (sort) {
    const [field, order] = JSON.parse(sort);
    query = query.sort({ [field]: order === 'ASC' ? 1 : -1 });
  }
  if (range) {
    const [start, end] = JSON.parse(range);
    query = query.skip(start).limit(end - start);
  }
  const all = (await query).map(c => convertModelToRest(model, c));
  res.header('Content-Range', `courses 0-${all.length - 1}/${count}`).json(all);
};

const MONGO_ID_LENGTH = 24;
const matchCondition = (keyword: string, options?: MatchOptions) => {
  const condition =
    options && options.match
      ? {
          $or: [...(keyword.length === MONGO_ID_LENGTH ? ['_id'] : []), ...options.match].map(field => ({
            [field]: keyword
          }))
        }
      : { _id: (keyword.length === MONGO_ID_LENGTH && keyword) || null };
  return condition;
};

export const getModel = (model: Model<any>, options?: MatchOptions) => async (req: Request, res: Response) => {
  const id = req.params.id;
  const obj = convertModelToRest(model, await model.findOne(matchCondition(id, options)));
  res.json(obj);
};

export const deleteModel = (model: Model<any>, options?: MatchOptions) => async (req: Request, res: Response) => {
  const id = req.params.id;
  const obj = await model.findOneAndDelete(matchCondition(id, options));
  res.json(obj);
};

export const postModel = (model: Model<any>, { preprocessor }: { preprocessor?: PreprocessorType }) => async (
  req: Request,
  res: Response
) => {
  const { body } = req;
  preprocess(body, preprocessor);
  const instance = new model(body);
  await instance.save();
  res.json(convertModelToRest(model, instance));
};

export const putModel = (model: Model<any>, { options }: { options?: MatchAndProcessorOptions }) => async (
  req: Request,
  res: Response
) => {
  const id = req.params.id;
  const {
    body: { id: _, ...body }
  } = req;
  preprocess(body, options.preprocessor);
  try {
    const instance = await model.findOneAndUpdate(
      matchCondition(id, options),
      {
        $set: body
      },
      { new: true }
    );
    res.json(convertModelToRest(model, instance));
  } catch (error) {
    console.log({ error });
    throw error;
  }
};

interface MatchOptions {
  match?: string[];
}

interface MatchAndProcessorOptions extends MatchOptions {
  preprocessor?: PreprocessorType;
}

type PreprocessorType = (object: any) => any;

interface RestifyOptions extends MatchOptions {
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
  { requestHandler, methods, match, preprocessor }: RestifyOptions
) => {
  // List
  if (!methods || methods.list) {
    if (requestHandler) {
      router.route('/').get(requestHandler, listModel(model));
    } else {
      router.route('/').get(listModel(model));
    }
  }

  // Create one
  if (!methods || methods.post) {
    if (requestHandler) {
      router.route('/').post(requestHandler, postModel(model, { preprocessor }));
    } else {
      router.route('/').post(postModel(model, { preprocessor }));
    }
  }

  // Fetch one
  if (!methods || methods.get) {
    if (requestHandler) {
      router.route('/:id').get(requestHandler, getModel(model, { match }));
    } else {
      router.route('/:id').get(getModel(model, { match }));
    }
  }

  // Update one
  if (!methods || methods.put) {
    if (requestHandler) {
      router.route('/:id').put(requestHandler, putModel(model, { options: { match, preprocessor } }));
      router.route('/:id').patch(requestHandler, putModel(model, { options: { match, preprocessor } }));
    } else {
      router.route('/:id').put(putModel(model, { options: { match, preprocessor } }));
      router.route('/:id').patch(putModel(model, { options: { match, preprocessor } }));
    }
  }

  // Delete one
  if (!methods || methods.delete) {
    if (requestHandler) {
      router.route('/:id').delete(requestHandler, deleteModel(model, { match }));
    } else {
      router.route('/:id').delete(deleteModel(model, { match }));
    }
  }
};
