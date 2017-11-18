#!/bin/bash
set -e # exit with nonzero exit code if anything fails
set -x

output_dir="addon/web-ext-artifacts"
gh_pages="docs"

# clear and re-create the out directory
rm -rf $output_dir || exit 0;
#mkdir $output_dir;  # web-ext creates it on the fly.

# run our compile script, discussed above
npm run build

# now sign the addOn
npm run sign

# go to the out directory and create a *new* Git repo
cp $output_dir/*.xpi $gh_pages

# inside this git repo we'll pretend to be a new user
git config user.name "Travis CI"
git config user.email "travis-ci@example.com"

git checkout -b addon-signed

# The first and only commit to this new Git repo contains all the
# files present with the commit message "Deploy to GitHub Pages".
git add .
git commit -m "Deploy to GitHub Pages"

# Force push from the current repo's master branch to the remote
# repo's gh-pages branch. (All previous history on the gh-pages branch
# will be lost, since we are overwriting it.) We redirect any output to
# /dev/null to hide any sensitive credential data that might otherwise be exposed.

git push --force --quiet "https://${GH_TOKEN}@${GH_REF}" addon-signed # > /dev/null 2>&1
