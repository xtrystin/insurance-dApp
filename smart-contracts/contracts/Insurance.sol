// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract Insurance {
    uint256 private constant MAX_TEXT_LENGTH = 512;

    mapping(address => bool) public admins;
    address[] public adminList;

    struct Policy {
        uint256 id;
        string name;
        uint256 premium;
        uint256 payout;
        bool isActive;
    }

    struct Claim {
        uint256 id;
        address policyholder;
        uint256 policyId;
        string description;
        uint256 payoutAmount;
        bool isApproved;
        bool isResolved;
        string resolveMessage;
    }

    uint256 public policyCount;
    uint256 public claimCount;

    mapping(uint256 => Policy) public policies;
    mapping(address => mapping(uint256 => bool)) public hasPolicy;
    mapping(address => mapping(uint256 => uint256)) public purchasedPayout;
    mapping(address => uint256[]) private userPolicyIds;

    mapping(uint256 => Claim) public claims;
    mapping(address => uint256[]) private userClaimIds;

    bool private resolvingClaim;

    event PolicyCreated(uint256 id, string name, uint256 premium, uint256 payout);
    event PolicyPurchased(address policyholder, uint256 policyId);
    event ClaimSubmitted(uint256 claimId, address policyholder, uint256 policyId);
    event ClaimResolved(uint256 claimId, bool approved);
    event PayoutSent(uint256 indexed claimId, address indexed policyholder, uint256 amount);
    event ContractFunded(address indexed funder, uint256 amount);
    event PolicyEdited(uint256 id, string name, uint256 premium, uint256 payout, bool isActive);
    event AdminAdded(address indexed admin);
    event AdminRemoved(address indexed admin);

    modifier onlyAdmin() {
        require(admins[msg.sender], "Only admin can call this");
        _;
    }

    modifier nonReentrant() {
        require(!resolvingClaim, "Reentrant call");
        resolvingClaim = true;
        _;
        resolvingClaim = false;
    }

    constructor() {
        admins[msg.sender] = true;
        adminList.push(msg.sender);
        emit AdminAdded(msg.sender);
    }

    function addAdmin(address _newAdmin) external onlyAdmin {
        require(_newAdmin != address(0), "Invalid admin address");
        require(!admins[_newAdmin], "Already an admin");
        admins[_newAdmin] = true;
        adminList.push(_newAdmin);
        emit AdminAdded(_newAdmin);
    }

    function removeAdmin(address _adminToRemove) external onlyAdmin {
        require(admins[_adminToRemove], "Not an admin");
        require(adminList.length > 1, "Cannot remove the last admin");
        require(_adminToRemove != msg.sender, "Cannot remove yourself");

        admins[_adminToRemove] = false;
        
        for (uint256 i = 0; i < adminList.length; i++) {
            if (adminList[i] == _adminToRemove) {
                adminList[i] = adminList[adminList.length - 1];
                adminList.pop();
                break;
            }
        }
        emit AdminRemoved(_adminToRemove);
    }

    function getAdmins() external view returns (address[] memory) {
        return adminList;
    }

    receive() external payable {
        emit ContractFunded(msg.sender, msg.value);
    }

    function fund() external payable {
        require(msg.value > 0, "Funding amount must be greater than zero");
        emit ContractFunded(msg.sender, msg.value);
    }

    function getContractBalance() external view returns (uint256) {
        return address(this).balance;
    }

    function createPolicy(string memory _name, uint256 _premium, uint256 _payout) external onlyAdmin {
        require(bytes(_name).length > 0, "Policy name is required");
        require(bytes(_name).length <= MAX_TEXT_LENGTH, "Policy name is too long");
        require(_premium > 0, "Premium must be greater than zero");
        require(_payout > 0, "Payout must be greater than zero");
        policyCount++;
        policies[policyCount] = Policy(policyCount, _name, _premium, _payout, true);
        emit PolicyCreated(policyCount, _name, _premium, _payout);
    }

    function editPolicy(uint256 _id, string memory _name, uint256 _premium, uint256 _payout, bool _isActive) external onlyAdmin {
        require(_policyExists(_id), "Invalid policy ID");
        require(bytes(_name).length > 0, "Policy name is required");
        require(bytes(_name).length <= MAX_TEXT_LENGTH, "Policy name is too long");
        require(_premium > 0, "Premium must be greater than zero");
        require(_payout > 0, "Payout must be greater than zero");
        Policy storage policy = policies[_id];
        policy.name = _name;
        policy.premium = _premium;
        policy.payout = _payout;
        policy.isActive = _isActive;
        
        emit PolicyEdited(_id, _name, _premium, _payout, _isActive);
    }

    function buyPolicy(uint256 _policyId) external payable {
        require(_policyExists(_policyId), "Invalid policy ID");
        Policy memory policy = policies[_policyId];
        require(policy.isActive, "Policy is not active");
        require(msg.value == policy.premium, "Incorrect premium amount");
        require(!hasPolicy[msg.sender][_policyId], "Already have this policy");

        hasPolicy[msg.sender][_policyId] = true;
        purchasedPayout[msg.sender][_policyId] = policy.payout;
        userPolicyIds[msg.sender].push(_policyId);
        emit PolicyPurchased(msg.sender, _policyId);
    }

    function submitClaim(uint256 _policyId, string memory _description) external {
        require(_policyExists(_policyId), "Invalid policy ID");
        require(hasPolicy[msg.sender][_policyId], "You don't own this policy");
        require(bytes(_description).length > 0, "Claim description is required");
        require(bytes(_description).length <= MAX_TEXT_LENGTH, "Claim description is too long");
        
        claimCount++;
        claims[claimCount] = Claim({
            id: claimCount,
            policyholder: msg.sender,
            policyId: _policyId,
            description: _description,
            payoutAmount: purchasedPayout[msg.sender][_policyId],
            isApproved: false,
            isResolved: false,
            resolveMessage: ""
        });
        userClaimIds[msg.sender].push(claimCount);

        emit ClaimSubmitted(claimCount, msg.sender, _policyId);
    }

    function resolveClaim(uint256 _claimId, bool _approve, string calldata _message) external onlyAdmin nonReentrant {
        require(_claimExists(_claimId), "Invalid claim ID");
        require(bytes(_message).length <= MAX_TEXT_LENGTH, "Resolve message is too long");
        Claim storage claim = claims[_claimId];
        require(!claim.isResolved, "Claim already resolved");
        
        claim.isResolved = true;
        claim.isApproved = _approve;
        claim.resolveMessage = _message;

        if (_approve) {
            require(address(this).balance >= claim.payoutAmount, "Not enough funds in contract");
            (bool sent, ) = payable(claim.policyholder).call{value: claim.payoutAmount}("");
            require(sent, "Payout transfer failed");
            emit PayoutSent(_claimId, claim.policyholder, claim.payoutAmount);
        }

        emit ClaimResolved(_claimId, _approve);
    }

    function getPolicies() external view returns (Policy[] memory) {
        Policy[] memory result = new Policy[](policyCount);
        for (uint256 i = 1; i <= policyCount; i++) {
            result[i - 1] = policies[i];
        }
        return result;
    }

    function getClaims() external view returns (Claim[] memory) {
        Claim[] memory result = new Claim[](claimCount);
        for (uint256 i = 1; i <= claimCount; i++) {
            result[i - 1] = claims[i];
        }
        return result;
    }

    function getUserPolicyIds(address _policyholder) external view returns (uint256[] memory) {
        return userPolicyIds[_policyholder];
    }

    function getUserClaims(address _policyholder) external view returns (Claim[] memory) {
        uint256[] memory ids = userClaimIds[_policyholder];
        Claim[] memory result = new Claim[](ids.length);
        for (uint256 i = 0; i < ids.length; i++) {
            result[i] = claims[ids[i]];
        }
        return result;
    }

    function _policyExists(uint256 _policyId) private view returns (bool) {
        return _policyId > 0 && _policyId <= policyCount;
    }

    function _claimExists(uint256 _claimId) private view returns (bool) {
        return _claimId > 0 && _claimId <= claimCount;
    }
}
