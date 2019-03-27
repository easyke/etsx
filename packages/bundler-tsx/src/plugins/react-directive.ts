export default ({
  types: t,
}: any) => {
  return {
    visitor: {
      CallExpression(path: any) {
        if (
          t.isIdentifier(path.node.callee, {
            name: 'createElement',
          })
        ) {
          const props = path.node.arguments[1].properties

          if (!props) {
            return
          }

          let ifStatement
          const rif = props.find((p: any) => p.key.value === 'r-if')

          if (rif) {
            path.node.arguments[1].properties = props.filter((p: any) => p !== rif)
            ifStatement = t.ifStatement(rif.value, t.returnStatement(path.node))
          }

          const rfor = props.find((p: any) => p.key.value === 'r-for')
          let forValue
          let forKey
          let forArray
          path.node.arguments[1].properties = path.node.arguments[1].properties.filter((p: any) => p !== rfor)

          if (
            rfor && t.isBinaryExpression(rfor.value, {
              operator: 'in',
            })
          ) {
            const v_rfor = rfor.value

            if (t.isIdentifier(v_rfor.right)) {
              forArray = v_rfor.right
            }
            if (t.isSequenceExpression(v_rfor.left)) {
              [forValue, forKey] = v_rfor.left.expressions
            } else if (t.isIdentifier(v_rfor.left)) {
              forValue = v_rfor.left
              forKey = t.identifier('index')
            }
            if (forArray && forValue && forKey) {
              let forItem
              if (!path.node.arguments[1].properties.find((p: any) => p.key.name === 'key')) {
                path.node.arguments[1].properties.push(t.objectProperty(t.identifier('key'), forKey))
              }
              forItem = ifStatement ? t.blockStatement([ifStatement]) : path.node
              path.replaceWith(t.expressionStatement(t.callExpression(t.memberExpression(forArray, t.identifier('map')), [t.arrowFunctionExpression([forValue, forKey], forItem)])))
            }
          } else if (ifStatement) {
            path.replaceWith(ifStatement)
          }
        }
      },
    },
  }
}
