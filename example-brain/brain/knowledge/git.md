# Git

## Undo last commit (giữ changes)

```bash
git reset --soft HEAD~1
```

- `--soft`: giữ changes trong staging
- `--mixed` (default): giữ changes nhưng unstage
- `--hard`: xoá hết changes → NGUY HIỂM

## Rebase vs Merge

**Merge**: tạo merge commit, giữ nguyên lịch sử
```bash
git merge feature-branch
```

**Rebase**: viết lại lịch sử, commit nằm thẳng hàng
```bash
git rebase main
```

Rule: rebase branch cá nhân, merge branch shared.

## Stash khi đang làm dở

```bash
git stash                  # cất changes
git stash pop              # lấy lại changes
git stash list             # xem danh sách stash
git stash drop stash@{0}   # xoá stash cụ thể
```

## Cherry-pick 1 commit từ branch khác

```bash
git cherry-pick abc1234
```

Lấy đúng 1 commit `abc1234` từ branch khác apply vào branch hiện tại.

## Xem ai sửa dòng nào

```bash
git blame file.ts
git log -p -- file.ts      # xem history changes của file
```
