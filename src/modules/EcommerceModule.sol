// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {CampaignStorage} from "../host/CampaignStorage.sol";

interface IRepaymentModuleCredit {
    function creditPoolFromCampaign(uint256 amount) external;
}

/// @title  EcommerceModule
/// @notice Producer-managed product checkout module for a Campaign.
///
///         The module keeps only the settlement-critical surface onchain:
///         SKU id, USDC price, inventory, order ids, payment split, and a
///         content hash/reference for the offchain order record. Public
///         catalogue details and private fulfillment data live in static
///         object storage.
///
///         Storage namespace: `keccak256("growfi.module.ecommerce.v1")`.
contract EcommerceModule {
    using SafeERC20 for IERC20;

    struct Sku {
        uint256 priceUsdc; // USDC-6 per unit
        uint256 inventory; // remaining sellable units
        uint256 sold;
        bool active;
        bool exists;
    }

    struct Order {
        uint256 id;
        address buyer;
        bytes32 skuId;
        uint256 quantity;
        uint256 grossPaid;
        uint256 protocolFee;
        uint256 repaymentAllocated;
        uint256 producerNet;
        bytes32 orderHash;
        uint64 placedAt;
    }

    struct Layout {
        string catalogURI;
        uint16 protocolFeeBps;
        uint16 repaymentAllocationBps;
        uint256 nextOrderId;
        uint256 grossSales;
        uint256 protocolFees;
        uint256 repaymentAllocated;
        mapping(bytes32 => Sku) skus;
        bytes32[] skuList;
        mapping(uint256 => Order) orders;
        mapping(bytes32 => uint256) orderIdByHash;
        mapping(address => uint256[]) buyerOrders;
        uint256 reentrancyStatus;
        bool initialized;
    }

    bytes32 internal constant STORAGE_SLOT = 0x9a79504829cc4654fe91ac9ddd53dc0c1f8cc1bbc7d254575e70a6bbe73274bc; // keccak256("growfi.module.ecommerce.v1")
    bytes32 internal constant TYPE_REPAYMENT = 0x8d8dbd54da6ed08f3af3f4408383e63b6594306608253e922377e052ddfbbc05; // keccak256("growfi.type.repayment")

    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;
    uint16 public constant MAX_PROTOCOL_FEE_BPS = 1_000; // 10%
    uint16 public constant MAX_TOTAL_SPLIT_BPS = 10_000;

    error AlreadyInitialized();
    error NotInitialized();
    error OnlyFactoryBootstrap();
    error OnlyProducer();
    error ZeroAmount();
    error ZeroSku();
    error InvalidState();
    error InvalidFee();
    error InvalidRepaymentAllocation();
    error RepaymentModuleInactive();
    error Reentrant();
    error SkuInactive();
    error SkuMissing();
    error InsufficientInventory();
    error OrderHashRequired();
    error OrderHashUsed();

    event EcommerceInitialized(uint16 protocolFeeBps, uint16 repaymentAllocationBps, string catalogURI);
    event EcommerceCatalogURISet(string oldCatalogURI, string newCatalogURI);
    event EcommerceProtocolFeeSet(uint16 oldFeeBps, uint16 newFeeBps);
    event EcommerceRepaymentAllocationSet(uint16 oldBps, uint16 newBps);
    event EcommerceSkuSet(bytes32 indexed skuId, uint256 priceUsdc, uint256 inventory, bool active);
    event EcommerceSkuActiveSet(bytes32 indexed skuId, bool active);
    event EcommerceOrderPlaced(
        uint256 indexed orderId,
        address indexed buyer,
        bytes32 indexed skuId,
        uint256 quantity,
        uint256 grossPaid,
        uint256 protocolFee,
        uint256 repaymentAllocated,
        uint256 producerNet,
        bytes32 orderHash
    );

    function _s() internal pure returns (Layout storage l) {
        bytes32 slot = STORAGE_SLOT;
        assembly {
            l.slot := slot
        }
    }

    modifier onlyProducer() {
        if (msg.sender != CampaignStorage.layout().producer) revert OnlyProducer();
        _;
    }

    modifier nonReentrant() {
        Layout storage s = _s();
        if (s.reentrancyStatus == _ENTERED) revert Reentrant();
        s.reentrancyStatus = _ENTERED;
        _;
        s.reentrancyStatus = _NOT_ENTERED;
    }

    struct InitParams {
        uint16 protocolFeeBps;
        string catalogURI;
    }

    function initializeEcommerce(InitParams calldata p) external {
        Layout storage s = _s();
        CampaignStorage.Layout storage cs = CampaignStorage.layout();
        if (s.initialized) revert AlreadyInitialized();
        if (msg.sender != cs.factory || !cs.factoryBootstrap) revert OnlyFactoryBootstrap();
        _initialize(s, p.protocolFeeBps, p.catalogURI);
    }

    function initializeEcommerceByProducer(uint16 initialProtocolFeeBps, string calldata initialCatalogURI)
        external
        onlyProducer
    {
        Layout storage s = _s();
        if (s.initialized) revert AlreadyInitialized();
        _initialize(s, initialProtocolFeeBps, initialCatalogURI);
    }

    function _initialize(Layout storage s, uint16 initialProtocolFeeBps, string calldata initialCatalogURI) internal {
        if (initialProtocolFeeBps > MAX_PROTOCOL_FEE_BPS) revert InvalidFee();
        s.protocolFeeBps = initialProtocolFeeBps;
        s.catalogURI = initialCatalogURI;
        s.nextOrderId = 1;
        s.reentrancyStatus = _NOT_ENTERED;
        s.initialized = true;
        emit EcommerceInitialized(initialProtocolFeeBps, 0, initialCatalogURI);
    }

    function setCatalogURI(string calldata newCatalogURI) external onlyProducer {
        Layout storage s = _s();
        if (!s.initialized) revert NotInitialized();
        string memory old = s.catalogURI;
        s.catalogURI = newCatalogURI;
        emit EcommerceCatalogURISet(old, newCatalogURI);
    }

    function setProtocolFeeBps(uint16 newFeeBps) external onlyProducer {
        if (newFeeBps > MAX_PROTOCOL_FEE_BPS) revert InvalidFee();
        Layout storage s = _s();
        if (!s.initialized) revert NotInitialized();
        if (uint256(newFeeBps) + uint256(s.repaymentAllocationBps) > MAX_TOTAL_SPLIT_BPS) {
            revert InvalidFee();
        }
        uint16 old = s.protocolFeeBps;
        s.protocolFeeBps = newFeeBps;
        emit EcommerceProtocolFeeSet(old, newFeeBps);
    }

    function setRepaymentAllocationBps(uint16 newBps) external onlyProducer {
        Layout storage s = _s();
        if (!s.initialized) revert NotInitialized();
        if (uint256(s.protocolFeeBps) + uint256(newBps) > MAX_TOTAL_SPLIT_BPS) {
            revert InvalidRepaymentAllocation();
        }
        uint16 old = s.repaymentAllocationBps;
        s.repaymentAllocationBps = newBps;
        emit EcommerceRepaymentAllocationSet(old, newBps);
    }

    function setSku(bytes32 skuId, uint256 priceUsdc, uint256 inventory, bool active) external onlyProducer {
        if (skuId == bytes32(0)) revert ZeroSku();
        if (priceUsdc == 0) revert ZeroAmount();
        Layout storage s = _s();
        if (!s.initialized) revert NotInitialized();

        Sku storage item = s.skus[skuId];
        if (!item.exists) {
            item.exists = true;
            s.skuList.push(skuId);
        }
        item.priceUsdc = priceUsdc;
        item.inventory = inventory;
        item.active = active;

        emit EcommerceSkuSet(skuId, priceUsdc, inventory, active);
    }

    function setSkuActive(bytes32 skuId, bool active) external onlyProducer {
        Layout storage s = _s();
        if (!s.initialized) revert NotInitialized();
        if (!s.skus[skuId].exists) revert SkuMissing();
        s.skus[skuId].active = active;
        emit EcommerceSkuActiveSet(skuId, active);
    }

    function buySku(bytes32 skuId, uint256 quantity, bytes32 orderHash) external nonReentrant {
        if (quantity == 0) revert ZeroAmount();
        if (orderHash == bytes32(0)) revert OrderHashRequired();

        CampaignStorage.Layout storage cs = CampaignStorage.layout();
        if (cs.paused || cs.state != uint8(CampaignStorage.State.Active)) revert InvalidState();

        Layout storage s = _s();
        if (!s.initialized) revert NotInitialized();
        if (s.orderIdByHash[orderHash] != 0) revert OrderHashUsed();

        Sku storage item = s.skus[skuId];
        if (!item.exists) revert SkuMissing();
        if (!item.active) revert SkuInactive();
        if (quantity > item.inventory) revert InsufficientInventory();

        uint256 gross = item.priceUsdc * quantity;
        uint256 fee = (gross * s.protocolFeeBps) / 10_000;
        uint256 repaymentAllocation = (gross * s.repaymentAllocationBps) / 10_000;
        if (repaymentAllocation > 0 && !_repaymentModuleActive(cs)) {
            revert RepaymentModuleInactive();
        }
        uint256 net = gross - fee - repaymentAllocation;

        item.inventory -= quantity;
        item.sold += quantity;
        s.grossSales += gross;
        s.protocolFees += fee;
        s.repaymentAllocated += repaymentAllocation;

        uint256 orderId = s.nextOrderId++;
        s.orders[orderId] = Order({
            id: orderId,
            buyer: msg.sender,
            skuId: skuId,
            quantity: quantity,
            grossPaid: gross,
            protocolFee: fee,
            repaymentAllocated: repaymentAllocation,
            producerNet: net,
            orderHash: orderHash,
            placedAt: uint64(block.timestamp)
        });
        s.orderIdByHash[orderHash] = orderId;
        s.buyerOrders[msg.sender].push(orderId);

        IERC20 usdc = IERC20(cs.usdc);
        usdc.safeTransferFrom(msg.sender, address(this), gross);
        if (fee > 0) usdc.safeTransfer(cs.protocolFeeRecipient, fee);
        if (repaymentAllocation > 0) {
            IRepaymentModuleCredit(address(this)).creditPoolFromCampaign(repaymentAllocation);
        }
        usdc.safeTransfer(cs.producer, net);

        emit EcommerceOrderPlaced(orderId, msg.sender, skuId, quantity, gross, fee, repaymentAllocation, net, orderHash);
    }

    function quoteSku(bytes32 skuId, uint256 quantity)
        external
        view
        returns (uint256 gross, uint256 protocolFee, uint256 repaymentAllocation, uint256 producerNet)
    {
        Layout storage s = _s();
        Sku storage item = s.skus[skuId];
        if (!item.exists) revert SkuMissing();
        gross = item.priceUsdc * quantity;
        protocolFee = (gross * s.protocolFeeBps) / 10_000;
        repaymentAllocation = (gross * s.repaymentAllocationBps) / 10_000;
        producerNet = gross - protocolFee - repaymentAllocation;
    }

    function _repaymentModuleActive(CampaignStorage.Layout storage cs) internal view returns (bool) {
        CampaignStorage.ModuleSlot storage slot = cs.moduleSlot[TYPE_REPAYMENT];
        return slot.impl != address(0) && slot.enabled;
    }

    function catalogURI() external view returns (string memory) {
        return _s().catalogURI;
    }

    function protocolFeeBps() external view returns (uint16) {
        return _s().protocolFeeBps;
    }

    function repaymentAllocationBps() external view returns (uint16) {
        return _s().repaymentAllocationBps;
    }

    function nextOrderId() external view returns (uint256) {
        return _s().nextOrderId;
    }

    function grossSales() external view returns (uint256) {
        return _s().grossSales;
    }

    function protocolFees() external view returns (uint256) {
        return _s().protocolFees;
    }

    function repaymentAllocated() external view returns (uint256) {
        return _s().repaymentAllocated;
    }

    function sku(bytes32 skuId) external view returns (Sku memory) {
        return _s().skus[skuId];
    }

    function skuCount() external view returns (uint256) {
        return _s().skuList.length;
    }

    function skuAt(uint256 index) external view returns (bytes32) {
        return _s().skuList[index];
    }

    function order(uint256 orderId) external view returns (Order memory) {
        return _s().orders[orderId];
    }

    function orderIdByHash(bytes32 orderHash) external view returns (uint256) {
        return _s().orderIdByHash[orderHash];
    }

    function buyerOrderCount(address buyer) external view returns (uint256) {
        return _s().buyerOrders[buyer].length;
    }

    function buyerOrderAt(address buyer, uint256 index) external view returns (uint256) {
        return _s().buyerOrders[buyer][index];
    }
}
