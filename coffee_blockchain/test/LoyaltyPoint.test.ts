import{expect} from "chai";
import {network} from "hardhat"
describe("Loyalty Contract",function(){
    it("nen cong diem va tru diem chinh xac",async function(){
        const {ethers}  = await network.connect();
        const [owner, customer] = await ethers.getSigners();
        const LoyaltyPoint = await ethers.getContractFactory("LoyaltyPoint");
        const contract = await LoyaltyPoint.deploy()
        await contract.earnPoints(customer.address, 50, "INV-001");
        expect(await contract.balanceOf(customer.address)).to.equal(50n);//test tich diem tu hoa don
        await expect(
            contract.earnPoint(customer.address,50,"INV-001")
        ).to.be.revertedWith("hoa don da dc tich diem") //test chong lap hoa don
        await contract.redeemPoints(customer.address,20, "RED-001");
        expect(await contract.balanceOf(customer.address)).to.equal(30n)
    });
});