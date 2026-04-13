# Video Processing Service FE Branching Setup

Muc tieu la chuan hoa release flow cho repo frontend:

- `main`: branch phat trien
- `staging`: branch test cho `test.plxeditor.com`
- `prod`: branch production cho `plxeditor.com`

## Cau truc thu muc

- Source repo:
  - `/home/vpsroot/projects/frontend/video-processing-service-fe`

## Thiet lap branch

```bash
cd /home/vpsroot/projects/frontend/video-processing-service-fe
git checkout main
git pull --ff-only origin main
git checkout -b staging
git push -u origin staging
git checkout main
git checkout -b prod
git push -u origin prod
git checkout main
```

## Promote release

```bash
cd /home/vpsroot/projects/frontend/video-processing-service-fe
./scripts/promote-branch.sh staging prod
```

## Domain mapping

- `staging` -> `https://test.plxeditor.com/`
- `prod` -> `https://plxeditor.com/`
