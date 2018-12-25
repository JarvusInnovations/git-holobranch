exports.command = 'create <url>';
exports.desc = 'Create a holosource for repo at url <url>';
exports.builder = {
    name: {
        describe: 'Name for the holosource'
    },
    ref: {
        describe: 'Name of ref to track in holosource repository',
        default: 'HEAD'
    }
};

exports.handler = async function createSource ({
    url,
    name = null,
    ref = null
}) {
    const path = require('path');
    const logger = require('../../lib/logger.js');
    const { Repo } = require('../../lib');


    // check inputs
    if (!url) {
        throw new Error('url required');
    }


    // get repo interface
    const repo = await Repo.getFromEnvironment({ working: true });
    logger.debug('instantiated repository:', repo);


    // generate source name if not specified
    if (!name) {
        logger.debug('computing name from url:', url);
        const nameStack = url.split(path.sep);
        name = nameStack.pop();

        if (name == '.git') {
            name = nameStack.pop();
        } else if (name.substr(-4) == '.git') {
            name = name.substr(0, name.length - 4);
        }
    }


    // get source interface
    const source = repo.getSource(name, {
        phantom: { url, ref }
    });


    // read source config
    if (await source.readConfig()) {
        throw new Error('holosource already configured');
    }


    // get low-level git interface
    const git = await repo.getGit();


    // examine remote repo/branch to discover absolute ref and current commit hash
    logger.info(`listing ${url}#${ref}`);
    const { hash, ref: remoteRef } = await source.queryRef();
    source.phantom.ref = remoteRef;


    // generate canonical source spec
    const { ref: specRef } = await source.getSpec();


    // fetch objects
    logger.info(`fetching ${url}#${remoteRef}@${hash}`);
    await git.fetch({ depth: 1 }, url, `+${hash}:${specRef}`);
    console.log(`fetched ${url}#${remoteRef}@${hash}`);


    // write config
    await source.writeConfig();
    console.log(`initialized ${source.getConfigPath()}`);
};
