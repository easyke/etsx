import { createElement, render, Component } from 'rax'
import WeexDriver from 'driver-weex'
import Router from './router'
import Index from '../../../wap/pages/Index'
import * as View from 'rax-view'

const r = new Router({
  createElement,
  Component,
  component: View,
  fullpath: '/home',
  mode: 'abstract',
  routes: [{
    path: '/home',
    routes: [
      {
        path: '', // www.example.com/home
        component: () => class SSS extends Component {
          render () {
            return (
              <View style={{
                padding: 50
              }}>
                <View style={{ 'leight': 50, 'margin-bottom': 20, 'background-color': '#ccc' }} onClick={() => r.push('/foo')}>go foo</View>
                <View style={{ 'leight': 50, 'margin-bottom': 20, 'background-color': '#ccc' }} onClick={() => r.push('/index')}>go index</View>
                <View style={{ 'leight': 50, 'margin-bottom': 20, 'background-color': '#ccc' }} onClick={() => r.push('/home/jack')}>go jack</View>
              </View>
            )
          }
        }
      },
      {
        path: '/:username', // www.example.com/home/xxx
        component: (params) => class SSS extends Component {
          render () {
            return <View>
              <View>{params.username}</View>
              <View onClick={() => r.push('/home')}>Go home</View>
            </View>
          }
        }
      }
    ]
  },
  {
    path: '/index',
    routes: [
      {
        path: '', // www.example.com/index
        component: () => Index
      }
    ]
  },
  {
    path: '/foo', // www.example.com/foo
    component: () => Index
  }
  ]
})

render(createElement(r.RouterView, {}), null, {
  driver: WeexDriver
})
