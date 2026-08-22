# FitLip Social Identity — Phase 1

Implemented:

- Public/private social profiles
- Unique usernames with automatic migration for existing users
- 160-character profile bio
- Profile photo upload stored as a protected MongoDB image buffer
- Public profile viewing
- One-way follow system with automatic acceptance for public profiles
- Follow requests for private profiles
- Followers/following counters
- Follow request accept/reject UI
- User/profile discovery by username or name
- Social profile preview from the Profile screen
- Existing friend, duel and achievement systems retained

## MongoDB

No manual data migration is required before the first startup. The backend startup sequence now:

1. Synchronizes User indexes.
2. Creates usernames for existing users that do not have one.
3. Defaults existing users without a visibility value to `private`.

A MongoDB backup is still recommended before deploying a schema migration.

## Profile photos

The app compresses the selected image before upload. The backend stores the image in MongoDB as a protected Buffer field and serves it from an authenticated endpoint. This avoids requiring a new third-party storage provider for Phase 1.

## API additions

### User profile

- `GET /api/user/profile`
- `PUT /api/user/profile`
- `PUT /api/user/profile/photo`
- `GET /api/user/profile/photo/:userId`

### Social profile/follow

- `GET /api/social/discover?q=`
- `GET /api/social/profile/:identifier`
- `POST /api/social/follow/:userId`
- `DELETE /api/social/follow/:userId`
- `GET /api/social/followers`
- `GET /api/social/following`
- `GET /api/social/follow-requests`
- `POST /api/social/follow-requests/:requestId/respond`

### Cloudinary profile images

Set these backend environment variables:

- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

Profile photos are uploaded server-side to Cloudinary. MongoDB stores only the Cloudinary public ID/URL and timestamp. Existing legacy binary profile photos are migrated to `fitlip/profiles/<userId>` on backend startup when Cloudinary is configured, then the binary fields are removed from MongoDB after a successful upload.
