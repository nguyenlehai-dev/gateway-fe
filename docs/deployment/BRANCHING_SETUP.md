# Gateway FE Branching Setup

Muc tieu la chuan hoa release flow cho repo frontend:

- `main`: branch phat trien
- `staging`: branch test cho `testgateway.plxeditor.com`
- `prod`: branch production cho `gateway.plxeditor.com`

## Cau truc thu muc

- Source repo:
  - `/home/vpsroot/projects/frontend/gateway-fe`

## Thiet lap branch

```bash
cd /home/vpsroot/projects/frontend/gateway-fe
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
cd /home/vpsroot/projects/frontend/gateway-fe
./scripts/promote-branch.sh staging prod
```

## Domain mapping

- `staging` -> `https://testgateway.plxeditor.com/`
- `prod` -> `https://gateway.plxeditor.com/`
