// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/Address.sol";

/**
 * @title MyContract
 * @dev Secure global message contract
 */
contract MyContract is ReentrancyGuard, Ownable, Pausable {
    using Address for address;

    // Events
    event MessageUpdated(address indexed user, string newMessage, uint256 timestamp);
    event MessageCleared(address indexed clearedBy);
    event RateLimitHit(address indexed user, uint256 timestamp);
    event SuspiciousActivity(address indexed user, string reason);
    event EmergencyAction(address indexed admin, string action);

    // Global message
    string private globalMessage;

    // Security state
    mapping(address => uint256) private lastMessageTime;
    mapping(address => uint256) private userMessageCount;
    mapping(address => bool) private blacklistedUsers;

    // Security constants
    uint256 private constant MAX_MESSAGE_LENGTH = 500;
    uint256 private constant MIN_MESSAGE_LENGTH = 1;
    uint256 private constant RATE_LIMIT_DURATION = 60;
    uint256 private constant MAX_MESSAGES_PER_MINUTE = 5;
    uint256 private constant COOLDOWN_PERIOD = 10;

    // Statistics
    uint256 private totalMessages;

    // Modifiers
    modifier validMessage(string calldata _message) {
        require(bytes(_message).length >= MIN_MESSAGE_LENGTH, "Message too short");
        require(bytes(_message).length <= MAX_MESSAGE_LENGTH, "Message too long");
        require(!_containsNullBytes(_message), "Null bytes not allowed");
        _;
    }

    modifier rateLimited() {
        require(!blacklistedUsers[msg.sender], "Blacklisted user");
        require(block.timestamp >= lastMessageTime[msg.sender] + COOLDOWN_PERIOD, "Cooldown active");

        if (block.timestamp >= lastMessageTime[msg.sender] + RATE_LIMIT_DURATION) {
            userMessageCount[msg.sender] = 0;
        }

        require(userMessageCount[msg.sender] < MAX_MESSAGES_PER_MINUTE, "Rate limit exceeded");
        _;
    }

    modifier notBlacklisted() {
        require(!blacklistedUsers[msg.sender], "Blacklisted user");
        _;
    }

    modifier onlyEOA() {
        require(!msg.sender.isContract(), "No contracts");
        require(msg.sender == tx.origin, "Proxy calls not allowed");
        _;
    }

    // Constructor
    constructor() {
        totalMessages = 0;
    }

    // Internal utils
    function _containsNullBytes(string calldata _str) internal pure returns (bool) {
        bytes memory strBytes = bytes(_str);
        for (uint256 i = 0; i < strBytes.length; i++) {
            if (strBytes[i] == 0x00) return true;
        }
        return false;
    }

    function _updateRateLimit(address user) internal {
        if (block.timestamp >= lastMessageTime[user] + RATE_LIMIT_DURATION) {
            userMessageCount[user] = 1;
        } else {
            userMessageCount[user]++;
        }
        lastMessageTime[user] = block.timestamp;

        if (userMessageCount[user] >= MAX_MESSAGES_PER_MINUTE - 1) {
            emit RateLimitHit(user, block.timestamp);
        }
    }

    function _detectSuspiciousActivity(address user, string calldata message) internal {
        if (keccak256(bytes(globalMessage)) == keccak256(bytes(message))) {
            emit SuspiciousActivity(user, "Repeated identical message");
        }
        if (userMessageCount[user] >= MAX_MESSAGES_PER_MINUTE) {
            emit SuspiciousActivity(user, "Rate limit exceeded");
        }
        if (bytes(message).length < 5 && userMessageCount[user] > 2) {
            emit SuspiciousActivity(user, "Potential spam");
        }
    }

    // Core: public message functions
    function getMessage() external view returns (string memory) {
        return globalMessage;
    }

    function setMessage(string calldata newMessage)
        external
        nonReentrant
        whenNotPaused
        validMessage(newMessage)
        rateLimited
        notBlacklisted
        onlyEOA
    {
        _detectSuspiciousActivity(msg.sender, newMessage);
        _updateRateLimit(msg.sender);

        globalMessage = newMessage;
        totalMessages++;

        emit MessageUpdated(msg.sender, newMessage, block.timestamp);
    }

    // Admin functions
    function clearMessage() external onlyOwner {
        globalMessage = "";
        emit MessageCleared(msg.sender);
    }

    function blacklistUser(address user) external onlyOwner {
        require(user != address(0) && user != owner(), "Invalid or owner");
        blacklistedUsers[user] = true;
        emit EmergencyAction(msg.sender, "User blacklisted");
    }

    function unblacklistUser(address user) external onlyOwner {
        require(user != address(0), "Invalid address");
        blacklistedUsers[user] = false;
        emit EmergencyAction(msg.sender, "User unblacklisted");
    }

    function emergencyPause() external onlyOwner {
        _pause();
        emit EmergencyAction(msg.sender, "Paused");
    }

    function emergencyUnpause() external onlyOwner {
        _unpause();
        emit EmergencyAction(msg.sender, "Unpaused");
    }

    function resetUser(address user) external onlyOwner {
        lastMessageTime[user] = 0;
        userMessageCount[user] = 0;
        blacklistedUsers[user] = false;
        emit EmergencyAction(msg.sender, "User reset");
    }

    // View functions
    function isBlacklisted(address user) external view returns (bool) {
        return blacklistedUsers[user];
    }

    function getUserStats(address user) external view onlyOwner returns (
        uint256 messageCount,
        uint256 lastMessage,
        bool isBlacklisted
    ) {
        return (
            userMessageCount[user],
            lastMessageTime[user],
            blacklistedUsers[user]
        );
    }

    function getContractStats() external view onlyOwner returns (
        uint256 total_messages,
        bool is_paused
    ) {
        return (totalMessages, paused());
    }

    function getRemainingCooldown(address user) external view returns (uint256) {
        if (block.timestamp >= lastMessageTime[user] + COOLDOWN_PERIOD) return 0;
        return lastMessageTime[user] + COOLDOWN_PERIOD - block.timestamp;
    }

    function getRemainingMessages(address user) external view returns (uint256) {
        if (block.timestamp >= lastMessageTime[user] + RATE_LIMIT_DURATION) {
            return MAX_MESSAGES_PER_MINUTE;
        }
        return MAX_MESSAGES_PER_MINUTE - userMessageCount[user];
    }

    function getSecurityInfo() external pure returns (
        uint256 maxLength,
        uint256 minLength,
        uint256 rateLimitDuration,
        uint256 maxMessagesPerMinute,
        uint256 cooldownPeriod
    ) {
        return (
            MAX_MESSAGE_LENGTH,
            MIN_MESSAGE_LENGTH,
            RATE_LIMIT_DURATION,
            MAX_MESSAGES_PER_MINUTE,
            COOLDOWN_PERIOD
        );
    }

    // Prevent accidental ETH sends
    receive() external payable {
        revert("No ETH allowed");
    }

    fallback() external payable {
        revert("Invalid function");
    }
}
