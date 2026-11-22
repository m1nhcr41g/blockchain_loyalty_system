const promotionService = require("../services/promotion.service");

// GET /promotions
async function getAll(req, res, next) {
    try {
        const filters = {
            status: req.query.status,
            productId: req.query.productId
        };
        const promotions = await promotionService.getAll(filters);
        return res.status(200).json({
            success: true,
            message: "Lấy danh sách chương trình khuyến mãi thành công",
            data: promotions,
            error: null
        });
    } catch (error) {
        next(error);
    }
}

// POST /promotions
async function create(req, res, next) {
    try {
        const promotion = await promotionService.create(req.body);
        return res.status(201).json({
            success: true,
            message: "Tạo chương trình khuyến mãi thành công",
            data: promotion,
            error: null
        });
    } catch (error) {
        next(error);
    }
}

// PUT /promotions/:id
async function update(req, res, next) {
    try {
        const promotion = await promotionService.update(
            req.params.id,
            req.body
        );
        return res.status(200).json({
            success: true,
            message: "Cập nhật chương trình khuyến mãi thành công",
            data: promotion,
            error: null
        });
    } catch (error) {
        next(error);
    }
}

// PATCH /promotions/:id/status
async function updateStatus(req, res, next) {
    try {
        const promotion = await promotionService.updateStatus(
            req.params.id,
            req.body.status
        );
        return res.status(200).json({
            success: true,
            message: "Cập nhật trạng thái chương trình khuyến mãi thành công",
            data: promotion,
            error: null
        });
    } catch (error) {
        next(error);
    }
}

module.exports = {
    getAll,
    create,
    update,
    updateStatus
};
