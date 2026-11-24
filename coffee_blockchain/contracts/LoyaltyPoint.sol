//SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract LoyaltyPoint is ERC20, Ownable{
    mapping(string=>bool) public processedReferences;
    event PointEarned(address indexed customer, uint256 amount, string referenceId, uint256 timestamp);
    event PointRedeemed(address indexed customer, uint256 amount, string referenceI, uint256 timestamp);
    constructor() ERC20("Coffee Loyalty Point", "CLP") Ownable(msg.sender){}
    function decimals() public pure override returns (uint8) {
        return 0;
    }
    function earnPoints(
        address customer,
        uint256 amount,
        string calldata referenceId
    ) external onlyOwner{
        require(customer!=address(0), "Dia chi vi ko hop le");
        require(amount>0,"So diem phai lon hon 0");
        require(!processedReferences[referenceId], "hoa don da dc tich diem");
        processedReferences[referenceId] = true;
        _mint(customer, amount);
        emit PointEarned(customer, amount, referenceId, block.timestamp);
    }

    function redeemPoints(
        address customer,
        uint256 amount,
        string calldata referenceId
    )external onlyOwner{
        require(customer!=address(0),"dia chi vi ko hop le");
        require(amount>0, "so diem phai lon hon 0");
        require(balanceOf(customer)>=amount, "so du diem tren blockchain ko du");
        require(!processedReferences[referenceId],"phieu doi qua da dc xu li");
        processedReferences[referenceId] = true;
        _burn(customer, amount);
        emit PointRedeemed(customer, amount, referenceId, block.timestamp);
    }
}