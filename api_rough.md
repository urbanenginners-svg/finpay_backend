1.  Admin Login : http://localhost:6009/api/v1/auth/superadmin/login

## accessToken : eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJzdXBlcmFkbWluIiwiZW1haWwiOiJzdXBlcmFkbWluQHNjaG9vbC5jb20iLCJyb2xlcyI6WyJTdXBlciBBZG1pbiJdLCJpYXQiOjE3NzE1ODYzOTgsImV4cCI6MTc3MjE5MTE5OH0.Hhr5GNYOigBQTkez2iWCUvotIGm0k062irxALIxPg_Q

---

## Franchise Registration Flow

### Step 1 – Register
POST http://localhost:6009/api/v1/franchise/register
```json
{
  "fullName": "Ravi Kumar",
  "phoneNumber": "9876543210",
  "email": "ravi@example.com",
  "password": "Secret@123"
}
```

### Resend OTP
POST http://localhost:6009/api/v1/franchise/resend-otp
```json
{ "phoneNumber": "9876543210" }
```

### Step 2 – Verify OTP → receive JWT
POST http://localhost:6009/api/v1/franchise/verify-otp
```json
{ "phoneNumber": "9876543210", "otp": "123456" }
```
Response includes `access_token`. Status → `society-details-pending`.

---

### Step 3 – Submit Society Details (NEW)
POST http://localhost:6009/api/v1/franchise/society-details
Authorization: Bearer <access_token>

**Option A – society selected from dropdown:**
```json
{
  "societyId": "society::abc123",
  "cartPlacementLocation": {
    "latitude": 12.9716,
    "longitude": 77.5946,
    "address": "Gate 2, Green Meadows, Bengaluru"
  },
  "totalFlats": 250,
  "occupiedFlats": 200,
  "monthlyRent": 5000,
  "cartPlacementPhotoIds": ["file::photo1", "file::photo2"]
}
```

**Option B – society not listed (manual entry via Google Places):**
```json
{
  "manualSociety": {
    "name": "Sunrise Heights",
    "placeId": "ChIJN1t_tDeuEmsRUsoyG83frY4",
    "formattedAddress": "123 MG Road, Bengaluru, Karnataka 560001, India",
    "latitude": 12.9716,
    "longitude": 77.5946
  },
  "cartPlacementLocation": {
    "latitude": 12.9718,
    "longitude": 77.5948,
    "address": "Main Gate, Sunrise Heights"
  },
  "totalFlats": 120,
  "occupiedFlats": 100,
  "monthlyRent": 3500,
  "cartPlacementPhotoIds": ["file::photo1"]
}
```
Status → `documents-pending`.

---

### Step 4 – Submit KYC Documents
POST http://localhost:6009/api/v1/franchise/documents
Authorization: Bearer <access_token>

### Step 5 – Get Registration Status (polling / lock screen)
GET http://localhost:6009/api/v1/franchise/status
Authorization: Bearer <access_token>

### Step 6 – Submit Transaction ID (after proposal payment)
POST http://localhost:6009/api/v1/franchise/submit-transaction
Authorization: Bearer <access_token>

---

2. Create Institution  : (Admin Access)
## API : http://localhost:6009/api/v1/institutions

3. 