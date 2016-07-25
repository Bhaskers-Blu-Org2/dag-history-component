import {
  SELECT_MAIN_VIEW,
  TOGGLE_BRANCH_CONTAINER,
  HIGHLIGHT_SUCCESSORS,
} from '../../../src/actions';

const INITIAL_STATE = {
  mainView: 'history',
  branchContainerExpanded: true,
  highlightSuccessorsOf: null,
};

export default function reduce(state = INITIAL_STATE, action) {
  let result = state;
  if (action.type === SELECT_MAIN_VIEW) {
    result = { ...state, mainView: action.payload };
  } else if (action.type === TOGGLE_BRANCH_CONTAINER) {
    result = { ...state, branchContainerExpanded: !state.branchContainerExpanded };
  } else if (action.type === HIGHLIGHT_SUCCESSORS) {
    const highlightedState = action.payload;
    if (highlightedState === state.highlightSuccessorsOf) {
      result = { ...state, highlightSuccessorsOf: null };
    } else {
      result = { ...state, highlightSuccessorsOf: highlightedState };
    }
  }
  return result;
}
