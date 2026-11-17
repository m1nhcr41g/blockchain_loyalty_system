CREATE DATABASE CoffeeBlockchainDB;
GO

USE CoffeeBlockchainDB;
GO

-- 1. Bảng Users (Quản lý chung Admin, Staff, Customer)
CREATE TABLE Users (
    userId VARCHAR(36) PRIMARY KEY,
    fullName NVARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    phone VARCHAR(15) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('ADMIN', 'STAFF', 'CUSTOMER')),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
    createdAt DATETIME NOT NULL DEFAULT GETDATE()
);
GO

-- 2. Bảng Customers (Thông tin ví Blockchain và điểm của Khách hàng)
CREATE TABLE Customers (
    userId VARCHAR(36) PRIMARY KEY,
    walletAddress VARCHAR(100) NULL,
    totalPoint INT NOT NULL DEFAULT 0 CHECK (totalPoint >= 0),
    CONSTRAINT FK_Customers_Users FOREIGN KEY (userId) REFERENCES Users(userId)
);
GO

-- Đảm bảo walletAddress là duy nhất khi đã liên kết ví (cho phép nhiều khách hàng chưa liên kết ví để NULL)
CREATE UNIQUE INDEX UX_Customers_WalletAddress 
ON Customers(walletAddress) 
WHERE walletAddress IS NOT NULL;
GO

-- 3. Bảng Staffs (Thông tin riêng của Nhân viên)
CREATE TABLE Staffs (
    userId VARCHAR(36) PRIMARY KEY,
    employeeCode VARCHAR(20) NOT NULL UNIQUE,
    CONSTRAINT FK_Staffs_Users FOREIGN KEY (userId) REFERENCES Users(userId)
);
GO

-- 4. Bảng Products (Danh mục sản phẩm đồ uống / bánh)
CREATE TABLE Products (
    productId VARCHAR(36) PRIMARY KEY,
    productName NVARCHAR(100) NOT NULL,
    category NVARCHAR(50) NOT NULL,
    price DECIMAL(18, 2) NOT NULL CHECK (price >= 0),
    imageUrl VARCHAR(255) NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE'))
);
GO

-- 5. Bảng Promotions (Chương trình khuyến mãi cộng điểm thêm theo từng sản phẩm)
CREATE TABLE Promotions (
    promotionId VARCHAR(36) PRIMARY KEY,
    productId VARCHAR(36) NOT NULL,
    promotionName NVARCHAR(150) NOT NULL,
    promotionType VARCHAR(30) NOT NULL,
    bonusPoint INT NOT NULL CHECK (bonusPoint > 0),
    startDate DATETIME NOT NULL,
    endDate DATETIME NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
    CONSTRAINT FK_Promotions_Products FOREIGN KEY (productId) REFERENCES Products(productId),
    CONSTRAINT CK_Promotions_Date CHECK (endDate >= startDate)
);
GO

-- 6. Bảng PointRules (Quy tắc quy đổi tiền sang điểm cơ bản & lưu lịch sử thay đổi theo startDate/endDate)
CREATE TABLE PointRules (
    ruleId VARCHAR(36) PRIMARY KEY,
	previousRuleId VARCHAR(36) NULL,
    ruleName NVARCHAR(100) NOT NULL,
    pointRate DECIMAL(10, 2) NOT NULL CHECK (pointRate > 0),
    minimumAmount DECIMAL(18, 2) NOT NULL DEFAULT 0 CHECK (minimumAmount >= 0),
    startDate DATETIME NOT NULL,
    endDate DATETIME NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
	CONSTRAINT FK_PointRules_PreviousRule FOREIGN KEY (previousRuleId) REFERENCES PointRules(ruleId),
	CONSTRAINT CK_PointRules_Date CHECK (endDate IS NULL OR endDate >= startDate)
);
GO

-- 7. Bảng Invoices (Hóa đơn bán hàng tại quầy)
CREATE TABLE Invoices (
    invoiceId VARCHAR(36) PRIMARY KEY,
    customerId VARCHAR(36) NOT NULL,
    staffId VARCHAR(36) NOT NULL,
    ruleId VARCHAR(36) NOT NULL,
    invoiceDate DATETIME NOT NULL DEFAULT GETDATE(),
    totalAmount DECIMAL(18, 2) NOT NULL CHECK (totalAmount >= 0),
    totalPoint INT NOT NULL DEFAULT 0 CHECK (totalPoint >= 0),
    paymentStatus VARCHAR(20) NOT NULL DEFAULT 'UNPAID' CHECK (paymentStatus IN ('PAID', 'UNPAID', 'CANCELLED')),
    CONSTRAINT FK_Invoices_Customers FOREIGN KEY (customerId) REFERENCES Customers(userId),
    CONSTRAINT FK_Invoices_Staffs FOREIGN KEY (staffId) REFERENCES Staffs(userId),
    CONSTRAINT FK_Invoices_PointRules FOREIGN KEY (ruleId) REFERENCES PointRules(ruleId)
);
GO

-- 8. Bảng InvoiceDetails (Chi tiết từng sản phẩm trong hóa đơn)
CREATE TABLE InvoiceDetails (
    invoiceDetailId VARCHAR(36) PRIMARY KEY,
    invoiceId VARCHAR(36) NOT NULL,
    productId VARCHAR(36) NOT NULL,
    quantity INT NOT NULL CHECK (quantity > 0),
    unitPrice DECIMAL(18, 2) NOT NULL CHECK (unitPrice >= 0),
    discount DECIMAL(18, 2) NOT NULL DEFAULT 0 CHECK (discount >= 0),
    CONSTRAINT FK_InvoiceDetails_Invoices FOREIGN KEY (invoiceId) REFERENCES Invoices(invoiceId) ON DELETE CASCADE,
    CONSTRAINT FK_InvoiceDetails_Products FOREIGN KEY (productId) REFERENCES Products(productId)
);
GO

-- 9. Bảng Rewards (Danh mục quà tặng đổi điểm)
CREATE TABLE Rewards (
    rewardId VARCHAR(36) PRIMARY KEY,
    rewardName NVARCHAR(100) NOT NULL,
    description NVARCHAR(255) NULL,
    imageUrl VARCHAR(255) NULL,
    requiredPoint INT NOT NULL CHECK (requiredPoint > 0),
    quantity INT NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE'))
);
GO

-- 10. Bảng RewardRedemptions (Phiếu đổi quà của khách hàng)
CREATE TABLE RewardRedemptions (
    redemptionId VARCHAR(36) PRIMARY KEY,
    customerId VARCHAR(36) NOT NULL,
    rewardId VARCHAR(36) NOT NULL,
    staffId VARCHAR(36) NULL, -- NULL khi khách mới tạo yêu cầu; cập nhật mã nhân viên khi xác nhận giao quà tại quầy
    redeemDate DATETIME NOT NULL DEFAULT GETDATE(),
    pointUsed INT NOT NULL CHECK (pointUsed > 0),
    redemptionCode VARCHAR(50) NOT NULL UNIQUE, -- Mã nhận quà tại quầy
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'DELIVERED', 'CANCELLED')),
    CONSTRAINT FK_RewardRedemptions_Customers FOREIGN KEY (customerId) REFERENCES Customers(userId),
    CONSTRAINT FK_RewardRedemptions_Rewards FOREIGN KEY (rewardId) REFERENCES Rewards(rewardId),
    CONSTRAINT FK_RewardRedemptions_Staffs FOREIGN KEY (staffId) REFERENCES Staffs(userId),
	CONSTRAINT CK_RewardRedemptions_Staff CHECK (status <> 'DELIVERED' OR staffId IS NOT NULL)
);
GO

-- 11. Bảng PointTransactions (Lịch sử giao dịch điểm đồng bộ từ Smart Contract)
CREATE TABLE PointTransactions (
    transactionId VARCHAR(36) PRIMARY KEY,
    customerId VARCHAR(36) NOT NULL,
    invoiceId VARCHAR(36) NULL,
    redemptionId VARCHAR(36) NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('EARN', 'REDEEM')),
    point INT NOT NULL CHECK (point > 0),
    txHash VARCHAR(100) NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SUCCESS', 'FAILED')),
    createdAt DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_PointTransactions_Customers FOREIGN KEY (customerId) REFERENCES Customers(userId),
    CONSTRAINT FK_PointTransactions_Invoices FOREIGN KEY (invoiceId) REFERENCES Invoices(invoiceId),
    CONSTRAINT FK_PointTransactions_Redemptions FOREIGN KEY (redemptionId) REFERENCES RewardRedemptions(redemptionId),
    CONSTRAINT CK_PointTransactions_Reference CHECK (
        (type = 'EARN' AND invoiceId IS NOT NULL AND redemptionId IS NULL) OR
        (type = 'REDEEM' AND redemptionId IS NOT NULL AND invoiceId IS NULL)
    ),
    CONSTRAINT CK_PointTransactions_Status CHECK (
        (status = 'SUCCESS' AND txHash IS NOT NULL)
        OR
        (status IN ('PENDING', 'FAILED'))
    )
);
GO

-- Đảm bảo txHash là duy nhất khi đã có mã giao dịch từ Blockchain
CREATE UNIQUE INDEX UX_PointTransactions_TxHash 
ON PointTransactions(txHash) 
WHERE txHash IS NOT NULL;
GO

-- Chống tích điểm trùng 2 lần cho cùng 1 hóa đơn (khi đang PENDING hoặc đã SUCCESS)
CREATE UNIQUE INDEX UX_PointTransactions_InvoiceId 
ON PointTransactions(invoiceId) 
WHERE invoiceId IS NOT NULL AND status IN ('PENDING', 'SUCCESS');
GO

-- Chống trừ điểm trùng 2 lần cho cùng 1 phiếu đổi quà (khi đang PENDING hoặc đã SUCCESS)
CREATE UNIQUE INDEX UX_PointTransactions_RedemptionId 
ON PointTransactions(redemptionId) 
WHERE redemptionId IS NOT NULL AND status IN ('PENDING', 'SUCCESS');
GO