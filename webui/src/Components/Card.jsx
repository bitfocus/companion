import React from "react";

export class Card extends React.Component {
  render() {
    return (
      <div style={{ border: "1px solid #ddd", padding: 16 }} {...this.props}>
        {this.props.children}
      </div>
    );
  }
}
