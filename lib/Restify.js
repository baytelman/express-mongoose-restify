"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) if (e.indexOf(p[i]) < 0)
            t[p[i]] = s[p[i]];
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
const IGNORE_PROPS_EDIT = ['createdAt', 'updatedAt', 'id', '_id'];
const removeReadOnlyProps = (obj) => IGNORE_PROPS_EDIT.forEach(prop => delete obj[prop]);
const preprocess = (obj, preprocesor) => {
    const propsWithoutReadOnly = removeReadOnlyProps(obj);
    if (preprocesor) {
        return preprocesor(propsWithoutReadOnly);
    }
    return propsWithoutReadOnly;
};
const convertModelToRest = (model, obj) => {
    const schema = model.schema;
    return (obj &&
        Object.keys(schema.paths).reduce((map, key) => {
            map[key] = obj[key];
            return map;
        }, { id: obj.id }));
};
exports.listModel = (model) => (req, res) => __awaiter(this, void 0, void 0, function* () {
    const { filter, range, sort } = req.query;
    const count = yield model.count({});
    const conditions = {};
    if (filter) {
        const { q } = JSON.parse(filter);
        if (q) {
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
    const all = (yield query).map(c => convertModelToRest(model, c));
    res.header('Content-Range', `courses 0-${all.length - 1}/${count}`).json(all);
});
const MONGO_ID_LENGTH = 24;
const matchCondition = (keyword, options) => {
    const condition = options && options.match
        ? {
            $or: [...(keyword.length === MONGO_ID_LENGTH ? ['_id'] : []), ...options.match].map(field => ({
                [field]: keyword
            }))
        }
        : { _id: (keyword.length === MONGO_ID_LENGTH && keyword) || null };
    return condition;
};
exports.getModel = (model, options) => (req, res) => __awaiter(this, void 0, void 0, function* () {
    const id = req.params.id;
    const obj = convertModelToRest(model, yield model.findOne(matchCondition(id, options)));
    res.json(obj);
});
exports.deleteModel = (model, options) => (req, res) => __awaiter(this, void 0, void 0, function* () {
    const id = req.params.id;
    const obj = yield model.findOneAndDelete(matchCondition(id, options));
    res.json(obj);
});
exports.postModel = (model, { preprocessor }) => (req, res) => __awaiter(this, void 0, void 0, function* () {
    const { body } = req;
    preprocess(body, preprocessor);
    const instance = new model(body);
    yield instance.save();
    res.json(convertModelToRest(model, instance));
});
exports.putModel = (model, { options }) => (req, res) => __awaiter(this, void 0, void 0, function* () {
    const id = req.params.id;
    const _a = req.body, { id: _ } = _a, body = __rest(_a, ["id"]);
    preprocess(body, options.preprocessor);
    try {
        const instance = yield model.findOneAndUpdate(matchCondition(id, options), {
            $set: body
        }, { new: true });
        res.json(convertModelToRest(model, instance));
    }
    catch (error) {
        console.log({ error });
        throw error;
    }
});
exports.restifyModel = (router, model, { requestHandler, methods, match, preprocessor }) => {
    if (!methods || methods.list) {
        if (requestHandler) {
            router.route('/').get(requestHandler, exports.listModel(model));
        }
        else {
            router.route('/').get(exports.listModel(model));
        }
    }
    if (!methods || methods.post) {
        if (requestHandler) {
            router.route('/').post(requestHandler, exports.postModel(model, { preprocessor }));
        }
        else {
            router.route('/').post(exports.postModel(model, { preprocessor }));
        }
    }
    if (!methods || methods.get) {
        if (requestHandler) {
            router.route('/:id').get(requestHandler, exports.getModel(model, { match }));
        }
        else {
            router.route('/:id').get(exports.getModel(model, { match }));
        }
    }
    if (!methods || methods.put) {
        if (requestHandler) {
            router.route('/:id').put(requestHandler, exports.putModel(model, { options: { match, preprocessor } }));
            router.route('/:id').patch(requestHandler, exports.putModel(model, { options: { match, preprocessor } }));
        }
        else {
            router.route('/:id').put(exports.putModel(model, { options: { match, preprocessor } }));
            router.route('/:id').patch(exports.putModel(model, { options: { match, preprocessor } }));
        }
    }
    if (!methods || methods.delete) {
        if (requestHandler) {
            router.route('/:id').delete(requestHandler, exports.deleteModel(model, { match }));
        }
        else {
            router.route('/:id').delete(exports.deleteModel(model, { match }));
        }
    }
};
//# sourceMappingURL=Restify.js.map