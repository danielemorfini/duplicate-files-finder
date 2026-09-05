# Duplicate files finder

Simple `node-cli` application to find duplicate files in a given directory recursively by `hash`.

> **Note:** this is a personal utility, built and tuned for my own occasional use rather than as a general-purpose tool.
>
> Feel free to read, fork, or adapt it, but don't expect it to cover cases outside what I actually needed.

## Usage

```
node src/index.js <folder_path> [--delete-duplicates] [--yes]
```

- `<folder_path>` - folder to scan recursively (required).
- `--delete-duplicates` - for each group of duplicates found, keep the oldest file and report the rest as candidates for deletion. Without `--yes` this is a **dry run**: nothing is deleted, only reported.
- `--yes` - only effective together with `--delete-duplicates`. Actually deletes the candidate files instead of just reporting them.

Reported file paths are shown relative to the scanned folder, using `$basePath` as a stand-in for `<folder_path>` (e.g. `$basePath/nested/file.txt`).

### Examples

```
# scan a folder and just report duplicates
node src/index.js ~/Downloads

# see what would be deleted, without deleting anything
node src/index.js ~/Downloads --delete-duplicates

# actually delete the duplicates (keeping the oldest copy of each)
node src/index.js ~/Downloads --delete-duplicates --yes
```

## Running tests

```
npm test
```
