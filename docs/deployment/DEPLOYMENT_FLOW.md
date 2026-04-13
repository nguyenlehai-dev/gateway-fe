# Video Processing Service FE Deployment Flow

## Domain Mapping

- `staging` branch -> `https://test.plxeditor.com/`
- `prod` branch -> `https://plxeditor.com/`

Production user entrypoint:

- `https://plxeditor.com/`

## Source Model

- Chi co **1 source goc** de phat trien frontend:
  - `/home/vpsroot/projects/frontend/video-processing-service-fe`
- Server khong nen chay frontend tu code chua build.
- Frontend release can di qua branch:
  - `main` cho phat trien
  - `staging` cho test
  - `prod` cho production

## Release Flow

1. Develop trong source repo `/home/vpsroot/projects/frontend/video-processing-service-fe`
2. Commit va push branch lam viec
3. Promote commit can test len `staging`
4. Build frontend tu branch `staging`
5. Deploy ban build len `test.plxeditor.com`
6. Validate tren test
7. Promote commit da validate len `prod`
8. Build lai tu `prod`
9. Deploy len `plxeditor.com`

Short form:

- `source -> staging -> build -> test -> promote -> prod -> build -> prod`

## SOP

1. Sua code trong `/home/vpsroot/projects/frontend/video-processing-service-fe`
2. Kiem tra `git status`
3. Build thu local theo stack frontend thuc te cua repo
4. Commit thay doi
5. Push branch hien tai
6. Promote len `staging`
7. Checkout `staging` va pull ban moi nhat
8. Chay build frontend
9. Sync ban build len web root test
10. QA tren `https://test.plxeditor.com/`
11. Promote `staging -> prod`
12. Checkout `prod` va pull ban moi nhat
13. Chay lai build frontend
14. Sync ban build len web root production
15. Smoke test `https://plxeditor.com/`

Lenh thuong dung:

```bash
cd /home/vpsroot/projects/frontend/video-processing-service-fe
git status
git add .
git commit -m "feat: mo ta thay doi"
git push origin HEAD
./scripts/promote-branch.sh staging prod
```

## Runtime Notes

- Repo hien tai moi duoc bootstrap branch flow, chua co stack frontend co dinh.
- Khi frontend duoc scaffold day du, can bo sung them:
  - build command chuan
  - thu muc output build
  - script deploy static cho `staging` va `prod`
  - vhost/nginx config neu can
- Khuyen nghi frontend goi API cung domain:
  - test: `/api/` -> `https://test.plxeditor.com/api/`
  - prod: `/api/` -> `https://plxeditor.com/api/`

## Verify

Sau khi frontend co build that su, it nhat can verify:

```bash
curl -I https://test.plxeditor.com/
curl -I https://plxeditor.com/
```

## Rules

- Khong deploy production truc tiep tu `main`
- Chi promote release `staging -> prod` bang git history
- Khong copy tay file le tu may local len server neu thay doi thuoc source code
- Frontend test va prod phai tro dung API cung domain `/api/`
