import React from 'dom-chef';
import select from 'select-dom';
import * as api from '../libs/api';
import features from '../libs/features';
import getDefaultBranch from '../libs/get-default-branch';
import {getOwnerAndRepo} from '../libs/utils';
import {openPullRequest} from '../libs/icons';

type RepositoryReference = {
	owner: string;
	branchExists: boolean;
	url?: string;
	label: string;
};

type BranchInfo = {
	baseRef: string;
	baseRefName: string;
	headRef: string;
	headOwner: {
		login: string;
	};
	headRefName: string;
	headRepository: {
		url: string;
	};
};

function normalizeBranchInfo(data: BranchInfo): {
	base?: RepositoryReference;
	head?: RepositoryReference;
} {
	const {ownerName, repoName} = getOwnerAndRepo();

	const base: Partial<RepositoryReference> = {};
	base.branchExists = Boolean(data.baseRef);
	base.label = data.baseRefName;
	if (base.branchExists) {
		base.url = `/${ownerName}/${repoName}/tree/${data.baseRefName}`;
	}

	const head: Partial<RepositoryReference> = {};
	head.branchExists = Boolean(data.headRef);
	head.owner = data.headOwner.login;
	if (!data.headOwner || data.headOwner.login === ownerName) {
		head.label = data.headRefName;
	} else {
		head.label = `${data.headOwner.login}:${data.headRefName}`;
	}

	if (head.branchExists) { // If the branch hasn't been deleted
		head.url = `${data.headRepository.url}/tree/${data.headRefName}`;
	} else if (data.headRepository) { // If the repo hasn't been deleted
		head.url = data.headRepository.url;
	}

	return {
		base: base as RepositoryReference,
		head: head as RepositoryReference
	};
}

function buildQuery(issueIds: string[]): string {
	const {ownerName, repoName} = getOwnerAndRepo();

	return `{
		repository(owner: "${ownerName}", name: "${repoName}") {
			${issueIds.map(id => `
				${id}: pullRequest(number: ${id.replace('issue_', '')}) {
					baseRef {id}
					headRef {id}
					baseRefName
					headRefName
					headRepository {url}
					headOwner: headRepositoryOwner {login}
				}
			`)}
		}
	}`;
}

function createLink(ref: RepositoryReference): HTMLSpanElement {
	return (
		<span
			className="commit-ref css-truncate user-select-contain mb-n1"
			style={(ref.branchExists ? {} : {textDecoration: 'line-through'})}>
			{
				ref.url ?
					<a title={(ref.branchExists ? ref.label : 'Deleted')} href={ref.url}>
						{ref.label}
					</a> :
					<span className="unknown-repo">unknown repository</span>
			}
		</span>
	);
}

async function init(): Promise<false | void> {
	const elements = select.all('.js-issue-row');
	if (elements.length === 0) {
		return false;
	}

	const {ownerName} = getOwnerAndRepo();
	const query = buildQuery(elements.map(pr => pr.id));
	const [data, defaultBranch] = await Promise.all([
		api.v4(query),
		getDefaultBranch()
	]);

	for (const PR of elements) {
		let branches;
		let {base, head} = normalizeBranchInfo(data.repository[PR.id]);

		if (base!.label === defaultBranch) {
			base = undefined;
		}

		if (head!.owner !== ownerName) {
			head = undefined;
		}

		if (base && head) {
			branches = <>From {createLink(head)} into {createLink(base)}</>;
		} else if (head) {
			branches = <>From {createLink(head)}</>;
		} else if (base) {
			branches = <>To {createLink(base)}</>;
		} else {
			continue;
		}

		select('.text-small.text-gray', PR)!.append(
			<span className="issue-meta-section d-inline-block">
				{openPullRequest()}
				{' '}
				{branches}
			</span>
		);
	}
}

features.add({
	id: 'pr-branches',
	description: 'Some head and base branches are shown on the PR list: The base branch is added when it’s not the repo’s default branch; The head branch is added when it’s from the same repo or the PR is by the current user.',
	include: [
		features.isPRList
	],
	load: features.onAjaxedPages,
	init
});
