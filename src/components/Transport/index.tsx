import * as React from "react";
const { default: keydown, Keys } = require("react-keydown");
const MdKeyboardArrowLeft = require("react-icons/lib/md/keyboard-arrow-left");
const MdKeyboardArrowRight = require("react-icons/lib/md/keyboard-arrow-right");
const MdSkipNext = require("react-icons/lib/md/skip-next");
const MdSkipPrevious = require("react-icons/lib/md/skip-previous");
const MdPlayArrow = require("react-icons/lib/md/play-arrow");
const MdPause = require("react-icons/lib/md/pause");

const { PropTypes } = React;
const DEFAULT_ICON_SIZE = 30;

import "./Transport.scss";

export interface ITransportProps {
  iconSize?: number;
  playing?: boolean;
  onPlay?: Function;
  onStop?: Function;
  onBack?: Function;
  onForward?: Function;
  onSkipToStart?: Function;
  onSkipToEnd?: Function;
  onStepForward?: Function;
  onStepBack?: Function;
}

export interface ITransportState {
}

class Transport extends React.Component<ITransportProps, ITransportState> {

  public static propTypes = {
    playing: PropTypes.bool,
    iconSize: PropTypes.number,
    onSkipToStart: PropTypes.func,
    onBack: PropTypes.func,
    onForward: PropTypes.func,
    onSkipToEnd: PropTypes.func,
    onStop: PropTypes.func,
    onPlay: PropTypes.func,
    onStepForward: PropTypes.func,
    onStepBack: PropTypes.func,
  };

  public static defaultProps = {
    iconSize: DEFAULT_ICON_SIZE,
    playing: false,
  };

  @keydown(Keys.SPACE)
  play() {
    if (this.props.onPlay) {
      this.props.onPlay();
    }
  }

  @keydown(Keys.LEFT)
  stepBack() {
    if (this.props.onStepBack) {
      this.props.onStepBack();
    }
  }

  @keydown(Keys.RIGHT)
  stepForward() {
    if (this.props.onStepForward) {
      this.props.onStepForward();
    }
  }

  @keydown(Keys.ESC)
  stop() {
    if (this.props.onStop) {
      this.props.onStop();
    }
  }

  @keydown(Keys.UP)
  back() {
    if (this.props.onBack) {
      this.props.onBack();
    }
  }

  @keydown(Keys.DOWN)
  forward() {
    if (this.props.onForward) {
      this.props.onForward();
    }
  }

  @keydown("shift+up")
  skipToStart() {
    if (this.props.onSkipToStart) {
      this.props.onSkipToStart();
    }
  }

  @keydown("shift+down")
  skipToEnd() {
    if (this.props.onSkipToEnd) {
      this.props.onSkipToEnd();
    }
  }

  render() {
    const {
      iconSize,
      onSkipToStart,
      onBack,
      onForward,
      onSkipToEnd,
      onPlay,
      onStop,
      playing,
    } = this.props;

    const playPauseButton = playing ?
      (<MdPause size={iconSize} onClick={() => this.stop()} />) :
      (<MdPlayArrow size={iconSize} onClick={() => this.play()} />)

    return (
      <div
        className="history-transport-panel"
        tabIndex={0}
        onKeyPress={() => {}} // allows event bubbling
      >
        <MdSkipPrevious size={iconSize} onClick={() => this.skipToStart()} />
        <MdKeyboardArrowLeft size={iconSize} onClick={() => this.back()} />
        {playPauseButton}
        <MdKeyboardArrowRight size={iconSize} onClick={() => this.forward()} />
        <MdSkipNext size={iconSize} onClick={() => this.skipToEnd()} />
      </div>
    );
  }
}
export default Transport;