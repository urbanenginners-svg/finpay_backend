<!-- GAP, BUG, TOBE -->



 ### A: GRN FLOW
1. When Consignment reaches the warehouse (Here it is marked that consignment has reached to the warehouse) :
 - API INFO:
    Request type: PATCH
    URL: consignment/:consignmentId/mark-at-warehouse

2. After that GRN will be done for that consignment 
- API INFO :
    Request type: PATCH
    URL: 'purchase-order/:purchaseOrderId/submit-grn'

From here packing will be done for product variants  and items will be released for EVCARTS