import fetch from 'cross-fetch'
import LoggerInstance from './Logger'
import fs from 'fs'
import save from 'save-file'

export async function fetchData(url: string, opts: RequestInit): Promise<Response> {
  const result = await fetch(url, opts)
  if (!result.ok) {
    LoggerInstance.error(`Error requesting [${opts.method}] ${url}`)
    LoggerInstance.error(`Response message: \n${await result.text()}`)
    throw result
  }
  return result
}

export async function downloadFile(
  url: string,
  destination?: string,
  index?: number
): Promise<string> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error('Response error.')
  }
  let filename: string
  try {
    filename = response.headers
      .get('content-disposition')
      .match(/attachment;filename=(.+)/)[1]
  } catch {
    try {
      filename = url.split('/').pop()
    } catch {
      filename = `file${index}`
    }
  }
  if (destination) {
    // eslint-disable-next-line no-async-promise-executor
    fs.mkdirSync(destination, { recursive: true })
    fs.writeFileSync(`${destination}/${filename}`, await response.text())
    return destination
  } else {
    save(await response.arrayBuffer(), filename)
  }
}

export async function getData(url: string): Promise<Response> {
  return fetch(url, {
    method: 'GET',
    headers: {
      'Content-type': 'application/json'
    }
  })
}

async function postWithHeaders(
  url: string,
  payload: BodyInit,
  headers: any
): Promise<Response> {
  if (payload != null) {
    return fetch(url, {
      method: 'POST',
      body: payload,
      headers
    })
  } else {
    return fetch(url, {
      method: 'POST'
    })
  }
}

export async function postData(url: string, payload: BodyInit): Promise<Response> {
  const headers = {
    'Content-type': 'application/json'
  }
  return postWithHeaders(url, payload, headers)
}

// simple fetch function used in tests
export async function crossFetchGeneric(
  method: string,
  url: string,
  body: string,
  headers: any
) {
  return fetch(url, {
    method: method,
    body: body,
    headers: headers
  })
}