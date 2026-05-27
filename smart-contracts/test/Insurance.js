import { expect } from "chai";
import hardhat from "hardhat";

const { ethers } = hardhat;

describe("Insurance", function () {
  async function deployInsurance() {
    const [admin, user, otherAdmin] = await ethers.getSigners();
    const Insurance = await ethers.getContractFactory("Insurance");
    const insurance = await Insurance.deploy();
    await insurance.waitForDeployment();

    return { insurance, admin, user, otherAdmin };
  }

  it("stores policies and user-owned policy ids on-chain", async function () {
    const { insurance, user } = await deployInsurance();
    const premium = ethers.parseEther("0.1");
    const payout = ethers.parseEther("1");

    await insurance.createPolicy("Car insurance", premium, payout);
    await insurance.connect(user).buyPolicy(1, { value: premium });

    const policies = await insurance.getPolicies();
    const userPolicyIds = await insurance.getUserPolicyIds(user.address);

    expect(policies).to.have.lengthOf(1);
    expect(policies[0].name).to.equal("Car insurance");
    expect(userPolicyIds.map((id) => id.toString())).to.deep.equal(["1"]);
  });

  it("rejects invalid policy, admin, and claim data", async function () {
    const { insurance } = await deployInsurance();

    await expect(insurance.addAdmin(ethers.ZeroAddress)).to.be.revertedWith("Invalid admin address");
    await expect(insurance.createPolicy("", 1, 1)).to.be.revertedWith("Policy name is required");
    await expect(insurance.createPolicy("No premium", 0, 1)).to.be.revertedWith("Premium must be greater than zero");
    await expect(insurance.resolveClaim(999, false, "")).to.be.revertedWith("Invalid claim ID");
  });

  it("accepts explicit funding and exposes contract balance", async function () {
    const { insurance, admin } = await deployInsurance();
    const amount = ethers.parseEther("10");

    await expect(insurance.fund({ value: amount }))
      .to.emit(insurance, "ContractFunded")
      .withArgs(admin.address, amount);

    expect(await insurance.getContractBalance()).to.equal(amount);
    await expect(insurance.fund({ value: 0 })).to.be.revertedWith("Funding amount must be greater than zero");
  });

  it("indexes user claims and resolves approved payouts", async function () {
    const { insurance, user } = await deployInsurance();
    const premium = ethers.parseEther("0.1");
    const payout = ethers.parseEther("1");

    await insurance.createPolicy("Travel insurance", premium, payout);
    await insurance.connect(user).buyPolicy(1, { value: premium });
    await insurance.connect(user).submitClaim(1, "Delayed flight");

    const userClaims = await insurance.getUserClaims(user.address);
    expect(userClaims).to.have.lengthOf(1);
    expect(userClaims[0].description).to.equal("Delayed flight");
    expect(userClaims[0].payoutAmount).to.equal(payout);

    await expect(
      insurance.resolveClaim(1, true, "Approved")
    ).to.be.revertedWith("Not enough funds in contract");

    await user.sendTransaction({ to: await insurance.getAddress(), value: payout });
    const resolveTx = await insurance.resolveClaim(1, true, "Approved");
    await expect(resolveTx).to.emit(insurance, "PayoutSent").withArgs(1, user.address, payout);
    await expect(resolveTx).to.changeEtherBalances([insurance, user], [-payout, payout]);

    const [claim] = await insurance.getUserClaims(user.address);
    expect(claim.isResolved).to.equal(true);
    expect(claim.isApproved).to.equal(true);
    expect(claim.resolveMessage).to.equal("Approved");
  });

  it("uses the purchased payout amount even if an admin edits the policy later", async function () {
    const { insurance, user } = await deployInsurance();
    const premium = ethers.parseEther("0.1");
    const originalPayout = ethers.parseEther("1");
    const editedPayout = ethers.parseEther("0.25");

    await insurance.createPolicy("Home insurance", premium, originalPayout);
    await insurance.connect(user).buyPolicy(1, { value: premium });
    await insurance.editPolicy(1, "Home insurance", premium, editedPayout, true);
    await insurance.connect(user).submitClaim(1, "Water damage");

    const [claim] = await insurance.getUserClaims(user.address);
    expect(claim.payoutAmount).to.equal(originalPayout);

    await user.sendTransaction({ to: await insurance.getAddress(), value: originalPayout });
    const resolveTx = await insurance.resolveClaim(1, true, "Approved");
    await expect(resolveTx).to.emit(insurance, "PayoutSent").withArgs(1, user.address, originalPayout);
    await expect(resolveTx).to.changeEtherBalances([insurance, user], [-originalPayout, originalPayout]);
  });

  it("keeps admin management constrained", async function () {
    const { insurance, admin, otherAdmin } = await deployInsurance();

    await expect(insurance.removeAdmin(admin.address)).to.be.revertedWith("Cannot remove the last admin");
    await insurance.addAdmin(otherAdmin.address);
    await expect(insurance.removeAdmin(admin.address)).to.be.revertedWith("Cannot remove yourself");
    await insurance.removeAdmin(otherAdmin.address);

    const admins = await insurance.getAdmins();
    expect(admins).to.deep.equal([admin.address]);
  });
});
