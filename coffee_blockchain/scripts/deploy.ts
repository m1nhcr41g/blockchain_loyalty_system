import { network  } from "hardhat";
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url";
import { error } from "console";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename)
async function main() {
    const{ethers} = await network.connect();
    const LoyaltyPoint = await ethers.getContractFactory("LoyaltyPoint");
    const loyaltyPoint = await LoyaltyPoint.deploy();
    await loyaltyPoint.waitForDeployment();
    const contractAddress = await loyaltyPoint.getAddress();
    console.log("loyalty deployed to: ",contractAddress);
    const artifactPath = path.join(__dirname,"../artifacts/contracts/LoyaltyPoint.sol/LoyaltyPoint.json"
    );
    const artifact = JSON.parse(fs.readFileSync(artifactPath,"utf8"));
    const backendAbiDir = path.join(__dirname, "../../coffee_backend/src/abi");
    if(!fs.existsSync(backendAbiDir)){
        fs.mkdirSync(backendAbiDir,{recursive:true});
    }
    fs.writeFileSync(path.join(backendAbiDir,"LoyaltyPoint.json"),JSON.stringify(artifact, null, 2));
    console.log("da xuat file abi sang coffee_backend/src/abi ");
}
    main().catch((error)=>{
        console.error(error);
        process.exitCode = 1;
    });