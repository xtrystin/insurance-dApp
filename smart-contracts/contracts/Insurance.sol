// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract Insurance {
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
        bool isApproved;
        bool isResolved;
        string resolveMessage;
    }

    uint256 public policyCount;
    uint256 public claimCount;

    mapping(uint256 => Policy) public policies;
    // Map user address => policyId => bool (has policy)
    mapping(address => mapping(uint256 => bool)) public hasPolicy;
    
    mapping(uint256 => Claim) public claims;

    event PolicyCreated(uint256 id, string name, uint256 premium, uint256 payout);
    event PolicyPurchased(address policyholder, uint256 policyId);
    event ClaimSubmitted(uint256 claimId, address policyholder, uint256 policyId);
    event ClaimResolved(uint256 claimId, bool approved);
    event PolicyEdited(uint256 id, string name, uint256 premium, uint256 payout, bool isActive);
    event AdminAdded(address indexed admin);
    event AdminRemoved(address indexed admin);

    modifier onlyAdmin() {
        require(admins[msg.sender], "Only admin can call this");
        _;
    }

    constructor() {
        admins[msg.sender] = true;
        adminList.push(msg.sender);
        emit AdminAdded(msg.sender);
    }

    function addAdmin(address _newAdmin) external onlyAdmin {
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

    // Admin can fund the contract to have balance for payouts
    receive() external payable {}

    function createPolicy(string memory _name, uint256 _premium, uint256 _payout) external onlyAdmin {
        policyCount++;
        policies[policyCount] = Policy(policyCount, _name, _premium, _payout, true);
        emit PolicyCreated(policyCount, _name, _premium, _payout);
    }

    function editPolicy(uint256 _id, string memory _name, uint256 _premium, uint256 _payout, bool _isActive) external onlyAdmin {
        require(_id > 0 && _id <= policyCount, "Invalid policy ID");
        Policy storage policy = policies[_id];
        policy.name = _name;
        policy.premium = _premium;
        policy.payout = _payout;
        policy.isActive = _isActive;
        
        emit PolicyEdited(_id, _name, _premium, _payout, _isActive);
    }

    function buyPolicy(uint256 _policyId) external payable {
        Policy memory policy = policies[_policyId];
        require(policy.isActive, "Policy is not active");
        require(msg.value == policy.premium, "Incorrect premium amount");
        require(!hasPolicy[msg.sender][_policyId], "Already have this policy");

        hasPolicy[msg.sender][_policyId] = true;
        emit PolicyPurchased(msg.sender, _policyId);
    }

    function submitClaim(uint256 _policyId, string memory _description) external {
        require(hasPolicy[msg.sender][_policyId], "You don't own this policy");
        
        claimCount++;
        claims[claimCount] = Claim({
            id: claimCount,
            policyholder: msg.sender,
            policyId: _policyId,
            description: _description,
            isApproved: false,
            isResolved: false,
            resolveMessage: ""
        });

        emit ClaimSubmitted(claimCount, msg.sender, _policyId);
    }

    function resolveClaim(uint256 _claimId, bool _approve, string calldata _message) external onlyAdmin {
        Claim storage claim = claims[_claimId];
        require(!claim.isResolved, "Claim already resolved");
        
        claim.isResolved = true;
        claim.isApproved = _approve;
        claim.resolveMessage = _message;

        if (_approve) {
            Policy memory policy = policies[claim.policyId];
            require(address(this).balance >= policy.payout, "Not enough funds in contract");
            payable(claim.policyholder).transfer(policy.payout);
        }

        emit ClaimResolved(_claimId, _approve);
    }
}
