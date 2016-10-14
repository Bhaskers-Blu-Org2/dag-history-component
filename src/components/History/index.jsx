import React, { PropTypes } from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import * as DagHistoryActions from 'redux-dag-history/lib/ActionCreators';
import DagGraph from 'redux-dag-history/lib/DagGraph';
import StateList from '../StateList';
import BranchList from '../BranchList';
import BookmarkList from '../BookmarkList';
import * as DagComponentActions from '../../actions';
import HistoryContainer from './HistoryContainer';
import ExpandCollapseToggle from '../ExpandCollapseToggle';
import Transport from '../Transport';
import PlaybackPane from '../PlaybackPane';
import './History.scss';

const log = require('debug')('dag-history-component:components:History');

const isNumber = d => !isNaN(d) && d !== null;

function getCurrentCommitPath(historyGraph) {
  const { currentBranch } = historyGraph;
  const latestCommitOnBranch = historyGraph.latestOn(currentBranch);
  return historyGraph.commitPath(latestCommitOnBranch);
}

const {
    jumpToState,
    jumpToLatestOnBranch,
    load,
    clear,
    addBookmark,
    removeBookmark,
    changeBookmark,
    moveBookmark,
    undo,
    redo,
    skipToStart,
    skipToEnd,
    pinState: highlightSuccessors,
    playBookmarkStory,
    skipToFirstBookmark,
    skipToLastBookmark,
    nextBookmark,
    previousBookmark,
    renameBranch,
} = DagHistoryActions;

const {
  selectMainView,
  toggleBranchContainer,
  editBookmark,
} = DagComponentActions;

export class History extends React.Component {
  shouldComponentUpdate(nextProps) {
    return this.props !== nextProps;
  }

  onSaveClicked() {
    log('history save clicked');
    const { history, controlBar: { onSaveHistory } } = this.props;
    const { current, lastBranchId, lastStateId, graph, bookmarks } = history;
    // Pass the plain history up to the client to save
    onSaveHistory({
      current,
      lastBranchId,
      lastStateId,
      bookmarks,
      graph: graph.toJS(),
    });
  }

  onLoadClicked() {
    log('history load clicked');
    const { onLoad, controlBar: { onLoadHistory } } = this.props;
    if (!onLoadHistory) {
      throw new Error("Cannot load history, 'onLoadHistory' must be defined");
    }
    return Promise.resolve(onLoadHistory()).then((state) => {
      if (!state) {
        throw new Error("'onLoadHistory' must return either a state graph object or a promise that resolves to a state graph object"); // eslint-disable-line
      }
      onLoad(state);
    });
  }

  onClearClicked() {
    const { onClear, controlBar: { onConfirmClear } } = this.props;
    log('clearing history');
    const doConfirm = onConfirmClear || (() => true);
    return Promise.resolve(doConfirm()).then(confirmed => confirmed && onClear());
  }

  onUnderViewClicked(underView) {
    log('underview clicked', underView);
    this.setState({ ...this.state, underView });
  }

  getStateList(historyGraph, commitPath, bookmarks) {
    const {
      currentBranch,
      currentStateId,
    } = historyGraph;
    const activeBranchStartsAt = historyGraph.branchStartDepth(currentBranch);
    const {
      highlightSuccessorsOf,
      getSourceFromState,
    } = this.props;
    return commitPath.map((id, index) => {
      const state = historyGraph.getState(id);
      const source = getSourceFromState(state);
      const label = historyGraph.stateName(id);

      const branchType = index < activeBranchStartsAt ? 'legacy' : 'current';
      const bookmarked = bookmarks.map(b => b.stateId).includes(id);
      const isSuccessor = isNumber(highlightSuccessorsOf) &&
        historyGraph.parentOf(id) === highlightSuccessorsOf;
      const pinned = highlightSuccessorsOf === id;
      const active = currentStateId === id;

      return {
        id,
        source,
        label,
        active,
        pinned,
        isSuccessor,
        continuationActive: id === highlightSuccessorsOf,
        branchType,
        bookmarked,
        continuation: {
          count: historyGraph.childrenOf(id).length,
        },
      };
    }).reverse();
  }

  getBranchList(historyGraph, commitPath) {
    const {
      branches,
      // maxDepth,
      currentBranch,
      currentStateId,
    } = historyGraph;
    const {
      highlightSuccessorsOf: pinnedState,
      onRenameBranch,
    } = this.props;
    const pinnedStateBranch = historyGraph.branchOf(pinnedState);

    // Determine what branches are on the commit path
    const branchPaths = {};
    const branchPath = commitPath.map(commit => historyGraph.branchOf(commit));
    branchPath.forEach((branch, index) => {
      if (branchPaths[branch]) {
        branchPaths[branch].end = index;
      } else {
        branchPaths[branch] = { start: index, end: index };
      }
    });

    // This is a hash of branchId -> stateId
    const selectedSuccessorsByBranch = {};
    if (isNumber(pinnedState)) {
      historyGraph.childrenOf(pinnedState).forEach((child) => {
        const branch = historyGraph.branchOf(child);
        selectedSuccessorsByBranch[branch] = child;
      });
    }

    const getSuccessorDepth = (branch) => {
      const successorId = selectedSuccessorsByBranch[branch];
      return successorId ?
        historyGraph.depthIndexOf(branch, successorId) :
        null;
    };

    const getPinnedStateDepth = (branch) => {
      if (!isNumber(pinnedState) || pinnedStateBranch !== branch) {
        return null;
      }
      return historyGraph.depthIndexOf(branch, pinnedState);
    };

    const activeStateBranch = historyGraph.branchOf(currentStateId);
    const activeStateIndex = historyGraph.depthIndexOf(activeStateBranch, currentStateId);

    let maxDepth = 0;
    const branchData = {};
    branches.forEach((branch) => {
      const startsAt = historyGraph.branchStartDepth(branch);
      const endsAt = historyGraph.branchEndDepth(branch);
      const length = (endsAt - startsAt);
      maxDepth = Math.max(maxDepth, length);
      branchData[branch] = {
        startsAt,
        endsAt,
        length,
      };
    });

    return branches.sort((a, b) => a - b).reverse().map((branch) => {
      const { startsAt, endsAt } = branchData[branch];
      const branchType = currentBranch === branch ? 'current' : 'legacy';
      const label = historyGraph.getBranchName(branch);
      const showActiveStateIndex = currentBranch === branch || activeStateBranch === branch;

      // Figure out where this branch intersects the commit path
      const myBranchPath = branchPaths[branch];
      const currentBranchStart = myBranchPath ? myBranchPath.start : null;
      const currentBranchEnd = myBranchPath ? myBranchPath.end : null;
      const successorDepth = !isNumber(pinnedState) ?
        null :
        getSuccessorDepth(branch);
      const pinnedStateIndex = getPinnedStateDepth(branch);
      return {
        id: branch,
        active: currentBranch === branch,
        label,
        activeStateIndex: showActiveStateIndex ? activeStateIndex : null,
        startsAt,
        endsAt,
        maxDepth,
        branchType,
        currentBranchStart,
        currentBranchEnd,
        successorDepth,
        pinnedStateIndex,
        onRename: name => onRenameBranch({ branch, name }),
      };
    })
    .filter(branch => (
      !pinnedState ||
      branch.active ||
      isNumber(branch.pinnedStateIndex) ||
      isNumber(branch.successorDepth)
    ));
  }

  renderStateList(historyGraph, commitPath) {
    const {
      onStateSelect,
      onAddBookmark,
      onRemoveBookmark,
      onHighlightSuccessors,
      history: { bookmarks },
      bookmarksEnabled,
    } = this.props;
    const { currentStateId } = historyGraph;
    const onStateContinuationClick = id => onHighlightSuccessors(id);
    const onStateBookmarkClick = (id) => {
      log('bookmarking state %s',
        id,
        bookmarks,
        bookmarks.map(b => b.stateId),
        bookmarks.map(b => b.stateId).includes(id)
      );
      const bookmarked = bookmarks.map(b => b.stateId).includes(id);
      log('bookmarked?', bookmarked);
      return bookmarked ? onRemoveBookmark(id) : onAddBookmark(id);
    };
    const stateList = this.getStateList(historyGraph, commitPath, bookmarks);
    return (
      <StateList
        activeStateId={currentStateId}
        states={stateList}
        onStateClick={onStateSelect}
        onStateContinuationClick={onStateContinuationClick}
        onStateBookmarkClick={onStateBookmarkClick}
        renderBookmarks={bookmarksEnabled}
      />
    );
  }

  renderBranchList(historyGraph, commitPath) {
    const { currentBranch } = historyGraph;
    const { onBranchSelect } = this.props;
    const onBranchContinuationClick = id => log('branch continuation clicked', id);
    const branchList = this.getBranchList(historyGraph, commitPath);
    return (
      <BranchList
        activeBranch={currentBranch}
        branches={branchList}
        onBranchClick={onBranchSelect}
        onBranchContinuationClick={onBranchContinuationClick}
      />
    );
  }

  renderBookmarks(historyGraph) {
    const { currentStateId } = historyGraph;
    const {
      history: { bookmarks },
      onStateSelect,
      onBookmarkChange,
      onBookmarkMove,
      onEditBookmark,
    } = this.props;
    const bookmarkData = bookmarks.map((b) => {
      const isSelected = b.stateId === currentStateId;
      return {
        ...b,
        active: isSelected,
        annotation: b.data.annotation || '',
        onEdit: () => onEditBookmark(b.stateId),
        onBookmarkChange: ({ name, data }) => onBookmarkChange({ bookmark: b.stateId, name, data }),
      };
    });
    return (
      <BookmarkList
        onEdit={onEditBookmark}
        bookmarks={bookmarkData}
        onBookmarkClick={id => onStateSelect(id)}
        onBookmarkContinuationClick={id => log(`bookmark ${id} continuation click`)}
        onBookmarkMove={onBookmarkMove}
      />
    );
  }

  renderHistoryView(historyGraph, commitPath) {
    const {
      branchContainerExpanded,
      onToggleBranchContainer,
      onUndo,
      onRedo,
      onSkipToStart,
      onSkipToEnd,
    } = this.props;
    const branchList = branchContainerExpanded ?
      this.renderBranchList(historyGraph, commitPath) :
      <div />;
    return (
      <div className="history-container">
        {this.renderStateList(historyGraph, commitPath)}
        <div className="branch-list-container">
          <div className="history-control-bar">
            <div className="title">Paths</div>
            <ExpandCollapseToggle
              isExpanded={branchContainerExpanded}
              onClick={onToggleBranchContainer}
            />
          </div>
          {branchList}
        </div>
        <Transport
          iconSize={30}
          onSkipToStart={onSkipToStart}
          onBack={onUndo}
          onForward={onRedo}
          onSkipToEnd={onSkipToEnd}
        />
      </div>
    );
  }

  renderStoryboardingView(historyGraph, commitPath) {
    const {
      onPlayBookmarkStory,
      onSkipToFirstBookmark,
      onSkipToLastBookmark,
      onNextBookmark,
      onPreviousBookmark,
    } = this.props;

    return (
      <div className="history-container">
        {this.renderBookmarks(historyGraph, commitPath)}
        <Transport
          showPlay
          iconSize={30}
          onSkipToStart={onSkipToFirstBookmark}
          onBack={onPreviousBookmark}
          onForward={onNextBookmark}
          onSkipToEnd={onSkipToLastBookmark}
          onPlay={onPlayBookmarkStory}
        />
      </div>
    );
  }

  renderPlayback() {
    const {
      history: {
        bookmarks,
        bookmarkPlaybackIndex,
      },
      onPlayBookmarkStory,
      onSkipToFirstBookmark,
      onSkipToLastBookmark,
      onNextBookmark,
      onPreviousBookmark,
    } = this.props;

    const bookmark = bookmarks[bookmarkPlaybackIndex];
    const slideText = bookmark.data.annotation || bookmark.name || 'No Slide Data';
    const isLastSlide = bookmarkPlaybackIndex === bookmarks.length - 1;
    // End the presentation if we're on the last slide
    const forwardAction = isLastSlide ? onPlayBookmarkStory : onNextBookmark;
    return (
      <div className="state-list-container">
        <PlaybackPane text={slideText} />
        <Transport
          showPause
          iconSize={30}
          onSkipToStart={onSkipToFirstBookmark}
          onBack={onPreviousBookmark}
          onForward={forwardAction}
          onSkipToEnd={onSkipToLastBookmark}
          onPlay={onPlayBookmarkStory}
        />
      </div>
    );
  }

  render() {
    const {
      history: {
        bookmarkPlaybackIndex,
        graph,
      },
      mainView,
      onSelectMainView,
      bookmarksEnabled,
    } = this.props;
    const isPlaybackMode = Number.isInteger(bookmarkPlaybackIndex);
    const historyGraph = new DagGraph(graph);
    const commitPath = getCurrentCommitPath(historyGraph);

    return isPlaybackMode ? this.renderPlayback() : (
      <HistoryContainer
        bookmarksEnabled={bookmarksEnabled}
        selectedTab={mainView}
        onTabSelect={onSelectMainView}
        historyView={this.renderHistoryView(historyGraph, commitPath)}
        storyboardingView={this.renderStoryboardingView(historyGraph, commitPath)}
        onSaveClicked={this.onSaveClicked.bind(this)}  // eslint-disable-line
        onLoadClicked={this.onLoadClicked.bind(this)}  // eslint-disable-line
        onClearClicked={this.onClearClicked.bind(this)}  // eslint-disable-line
      />
    );
  }
}

History.propTypes = {
  /**
   * The Dag-History Object
   */
  history: PropTypes.object.isRequired, // eslint-disable-line
  mainView: PropTypes.string.isRequired,
  getSourceFromState: PropTypes.func.isRequired,
  branchContainerExpanded: PropTypes.bool,
  highlightSuccessorsOf: PropTypes.number,

  /**
   * User Interaction Handlers - loaded by redux
   */
  onBranchSelect: PropTypes.func,
  onStateSelect: PropTypes.func,
  onLoad: PropTypes.func,
  onClear: PropTypes.func,
  onAddBookmark: PropTypes.func,
  onRemoveBookmark: PropTypes.func,
  onBookmarkChange: PropTypes.func,
  onSelectMainView: PropTypes.func,
  onToggleBranchContainer: PropTypes.func,
  onBookmarkMove: PropTypes.func,
  onHighlightSuccessors: PropTypes.func,
  onUndo: PropTypes.func,
  onRedo: PropTypes.func,
  onSkipToStart: PropTypes.func,
  onSkipToEnd: PropTypes.func,
  onPlayBookmarkStory: PropTypes.func,
  onSkipToFirstBookmark: PropTypes.func,
  onSkipToLastBookmark: PropTypes.func,
  onNextBookmark: PropTypes.func,
  onPreviousBookmark: PropTypes.func,
  onRenameBranch: PropTypes.func,
  onEditBookmark: PropTypes.func,

  /**
   * ControlBar Configuration Properties
   */
  controlBar: PropTypes.shape({
    /**
     * A handler to save the history tree out. This is handled by clients.
     */
    onSaveHistory: PropTypes.func,

    /**
     * A handler to retrieve the history tree. This is handled by clients
     */
    onLoadHistory: PropTypes.func,

    /**
     * A function that emits a Promise<boolean> that confirms the clear-history operation.
     */
    onConfirmClear: PropTypes.func,
  }),

  /**
   * Bookbark Configuration Properties
   */
  bookmarksEnabled: PropTypes.bool,
};
export default connect(
  () => ({}), // we don't dictate state-shape
  dispatch => bindActionCreators({
    onStateSelect: jumpToState,
    onBranchSelect: jumpToLatestOnBranch,
    onClear: clear,
    onLoad: load,
    onRenameBranch: renameBranch,
    onAddBookmark: addBookmark,
    onRemoveBookmark: removeBookmark,
    onBookmarkChange: changeBookmark,
    onSelectMainView: selectMainView,
    onToggleBranchContainer: toggleBranchContainer,
    onBookmarkMove: moveBookmark,
    onUndo: undo,
    onRedo: redo,
    onSkipToStart: skipToStart,
    onSkipToEnd: skipToEnd,
    onHighlightSuccessors: highlightSuccessors,
    onPlayBookmarkStory: playBookmarkStory,
    onSkipToFirstBookmark: skipToFirstBookmark,
    onSkipToLastBookmark: skipToLastBookmark,
    onNextBookmark: nextBookmark,
    onPreviousBookmark: previousBookmark,
    onEditBookmark: editBookmark,
  }, dispatch)
)(History);
