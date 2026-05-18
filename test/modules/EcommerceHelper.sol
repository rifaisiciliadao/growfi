// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {EcommerceModule} from "../../src/modules/EcommerceModule.sol";

library EcommerceHelper {
    function selectors() internal pure returns (bytes4[] memory s) {
        s = new bytes4[](23);
        uint256 i;
        s[i++] = EcommerceModule.initializeEcommerce.selector;
        s[i++] = EcommerceModule.initializeEcommerceByProducer.selector;
        s[i++] = EcommerceModule.setCatalogURI.selector;
        s[i++] = EcommerceModule.setProtocolFeeBps.selector;
        s[i++] = EcommerceModule.setRepaymentAllocationBps.selector;
        s[i++] = EcommerceModule.setSku.selector;
        s[i++] = EcommerceModule.setSkuActive.selector;
        s[i++] = EcommerceModule.buySku.selector;
        s[i++] = EcommerceModule.quoteSku.selector;
        s[i++] = EcommerceModule.catalogURI.selector;
        s[i++] = EcommerceModule.protocolFeeBps.selector;
        s[i++] = EcommerceModule.repaymentAllocationBps.selector;
        s[i++] = EcommerceModule.nextOrderId.selector;
        s[i++] = EcommerceModule.grossSales.selector;
        s[i++] = EcommerceModule.protocolFees.selector;
        s[i++] = EcommerceModule.repaymentAllocated.selector;
        s[i++] = EcommerceModule.sku.selector;
        s[i++] = EcommerceModule.skuCount.selector;
        s[i++] = EcommerceModule.skuAt.selector;
        s[i++] = EcommerceModule.order.selector;
        s[i++] = EcommerceModule.orderIdByHash.selector;
        s[i++] = EcommerceModule.buyerOrderCount.selector;
        s[i++] = EcommerceModule.buyerOrderAt.selector;
    }
}
