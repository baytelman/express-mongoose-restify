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
const convertModelToRest = (model, obj) => {
    const map = { id: obj.id };
    const schema = model.schema;
    Object.keys(schema.paths).forEach((key) => {
        map[key] = obj[key];
    });
    return map;
};
exports.listModel = (model) => (req, res) => __awaiter(this, void 0, void 0, function* () {
    const { filter, range, sort } = req.query;
    const count = yield model.count({});
    const conditions = {};
    if (filter) {
        const { q } = JSON.parse(filter);
        if (q) {
            conditions['$or'] = Object.keys(model.schema.obj).map(k => ({ [k]: new RegExp(q, 'i') }));
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
exports.getModel = (model) => (req, res) => __awaiter(this, void 0, void 0, function* () {
    const id = req.params.id;
    const obj = convertModelToRest(model, yield model.findById(id));
    res.json(obj);
});
exports.deleteModel = (model) => (req, res) => __awaiter(this, void 0, void 0, function* () {
    const id = req.params.id;
    const obj = yield model.findByIdAndDelete(id);
    res.json(obj);
});
exports.postModel = (model) => (req, res) => __awaiter(this, void 0, void 0, function* () {
    const { body } = req;
    const instance = new model(body);
    yield instance.save();
    res.json(convertModelToRest(model, instance));
});
exports.putModel = (model) => (req, res) => __awaiter(this, void 0, void 0, function* () {
    const id = req.params.id;
    const _a = req.body, { id: _ } = _a, body = __rest(_a, ["id"]);
    try {
        const instance = yield model.findOneAndUpdate({ _id: id }, {
            $set: body
        }, { new: true });
        res.json(convertModelToRest(model, instance));
    }
    catch (error) {
        console.log({ error });
        throw error;
    }
});
exports.restifyModel = (router, model, { preprocesor, methods }) => {
    if (!methods || methods.list) {
        if (preprocesor) {
            router.route('/').get(preprocesor, exports.listModel(model));
        }
        else {
            router.route('/').get(exports.listModel(model));
        }
    }
    if (!methods || methods.post) {
        if (preprocesor) {
            router.route('/').post(preprocesor, exports.postModel(model));
        }
        else {
            router.route('/').post(exports.postModel(model));
        }
    }
    if (!methods || methods.get) {
        if (preprocesor) {
            router.route('/:id').get(preprocesor, exports.getModel(model));
        }
        else {
            router.route('/:id').get(exports.getModel(model));
        }
    }
    if (!methods || methods.put) {
        if (preprocesor) {
            router.route('/:id').put(preprocesor, exports.putModel(model));
            router.route('/:id').patch(preprocesor, exports.putModel(model));
        }
        else {
            router.route('/:id').put(exports.putModel(model));
            router.route('/:id').patch(exports.putModel(model));
        }
    }
    if (!methods || methods.delete) {
        if (preprocesor) {
            router.route('/:id').delete(preprocesor, exports.deleteModel(model));
        }
        else {
            router.route('/:id').delete(exports.deleteModel(model));
        }
    }
};
//# sourceMappingURL=Restify.js.map