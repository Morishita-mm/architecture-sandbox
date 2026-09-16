import { Fragment } from 'react';
import { componentExamples } from '../constants/componentExamples';
import { getNodeStyle } from '../utils/nodeStyles';

export function ComponentConnectionExample({ type }: { type: string }) {
  const example = componentExamples[type];
  const description = example.stages.map((stage, index) => `${index ? `${example.links[index - 1]} → ` : ''}${stage.join(' / ')}`).join(' → ');
  const scopeStyle = example.scope ? getNodeStyle(example.scope) : undefined;

  return <figure className="connection-example">
    <h3>{example.scope ? '配置と接続の例' : example.association ? '適用の例' : '接続の例'}</h3>
    <div role="img" aria-label={`${example.scope ? `${example.scope}の中に配置：` : ''}${description}`}>
      <div aria-hidden="true" className={example.scope ? 'connection-example-scope' : undefined} style={scopeStyle && { borderColor: scopeStyle.border, background: scopeStyle.bg }}>
        {example.scope && <div className="connection-example-scope-label">{example.scope}<small>この部品</small></div>}
        <div className={`connection-example-flow${example.association ? ' connection-example-association' : ''}`}>
          {example.stages.map((stage, index) => <Fragment key={index}>
            {index > 0 && <div className="connection-example-link"><span>{example.links[index - 1]}</span><i /></div>}
            <div className={`connection-example-stage${stage.length > 1 && index > 0 ? ' connection-example-branch' : ''}`}>
              {stage.map((nodeType, nodeIndex) => {
                const style = getNodeStyle(nodeType);
                return <div key={nodeIndex} className="connection-example-node" style={{ borderColor: style.border, background: style.bg }}>
                  {nodeType === type && <small>この部品</small>}
                  <strong>{nodeType}{stage.filter(item => item === nodeType).length > 1 ? ` ${nodeIndex + 1}` : ''}</strong>
                </div>;
              })}
            </div>
          </Fragment>)}
        </div>
      </div>
    </div>
    <figcaption>{example.caption}</figcaption>
  </figure>;
}
