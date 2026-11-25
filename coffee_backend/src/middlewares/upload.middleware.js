const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { createError } = require('../utils/response');

const allowedMimeTypes = [
    'image/jpeg',
    'image/png',
    'image/webp'
];

const fileFilter = (req, file, cb) => {
    if (allowedMimeTypes.includes(file.mimetype)) {
        return cb(null, true);
    }

    return cb(
        createError(
            'Chỉ chấp nhận file ảnh JPG, PNG hoặc WEBP',400,'INVALID_FILE_TYPE'
        ),
        false
    );
};

// Hàm factory tạo middleware upload cho từng thư mục (products, rewards...)
const createImageUploader = (folderName, filePrefix) => {
    const uploadDir = path.join(__dirname, `../../uploads/${folderName}`);

    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
    }

    const storage = multer.diskStorage({
        destination: (req, file, cb) => {
            cb(null, uploadDir);
        },
        filename: (req, file, cb) => {
            const extension = path.extname(file.originalname).toLowerCase();
            const uniqueName = `${filePrefix}-${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`;
            cb(null, uniqueName);
        }
    });

    const upload = multer({
        storage,
        fileFilter,
        limits: {
            fileSize: 5 * 1024 * 1024 // 5MB
        }
    });

    const singleUpload = upload.single('image');

    return (req, res, next) => {
        singleUpload(req, res, (err) => {
            if (!err) {
                return next();
            }

            if (err instanceof multer.MulterError) {
                if (err.code === 'LIMIT_FILE_SIZE') {
                    return next(
                        createError('Dung lượng ảnh tối đa là 5MB',400,'FILE_TOO_LARGE')
                    );
                }

                return next(
                    createError(`Lỗi upload ảnh: ${err.message}`,400,'UPLOAD_ERROR')
                );
            }

            return next(err);
        });
    };
};

const uploadProductImage = createImageUploader('products', 'product');
const uploadRewardImage = createImageUploader('rewards', 'reward');

module.exports = {
    uploadProductImage,
    uploadRewardImage
};