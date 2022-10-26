import './App.css'

// implements a rule to match and extract a standardized value for
// a single field
interface IFieldMatcher {
  // readable name to disambiguate which rule matched
  kind: string;

  // return standardized value, or null if no match
  match(s: string): string | null;
}

// ties an individual field in the part specification to a collection
// of matching rules that can extract its values
interface ISpecField {
  // readable name for the field
  kind: string;

  // list of rules to match and extract values for the field
  matchers: IFieldMatcher[]
}

const SPECIFICATION: ISpecField[] = [
  {
    kind: 'PRODUCT TYPE',
    matchers: [
      {
        kind: 'FLANGE',
        match: (s) => {
          if (s.match(/^((FLANGE)|(FLNG)|(FLG))$/))
            return 'FLANGE';
          else
            return null;
        }
      },
      {
        kind: 'PIPE',
        match: (s) => {
          if (s.match(/^PIPE$/))
            return 'PIPE';
          else
            return null;
        }
      },
    ]
  },
  {
    kind: 'SIZE',
    matchers: [
      {
        kind: 'INCHES',
        match: (s) => {
          const m = s.match(/^(\d+(?:\.\d)?)\"$/);
          if (m)
            return m[1]; // first capture group, the number
          else
            return null;
        }
      }
    ]
  },
  {
    kind: 'FLANGE TYPE',
    matchers: [
      {
        kind: 'WELD NECK',
        match: (s) => {
          const m = s.match(/^((WE?LD ?NE?CK( FLA?NGE?)?)|(WNF?)(WELD))$/);
          return m ? 'WELD NECK' : null;
        }
      }
    ]
  },
  {
    kind: 'PRESSURE RATING',
    matchers: [
      {
        kind: 'POUNDS',
        match: (s) => {
          const m = s.match(/^((\d\d\d\#)|(\d\d\d (LB)|(PSI))|(CL \d\d\d))$/);
          return m ? (s.match(/\d+/) || [])[0] : null;
        }
      }
    ]
  },
  {
    kind: 'BORE SCHEDULE SIZE',
    matchers: [
      {
        kind: 'SCHEDULE INCHES',
        match: (s) => {
          const m = s.match(/^S(?:CH(?:EDULE)?)?[\- ](\d+)$/);
          return m ? m[1] : null;
        }
      },
      {
        kind: 'SCHEDULE STANDARD',
        match: (s) => {
          const m = s.match(/^(S(CH(EDULE)?)? (STD)|(STANDARD))$/);
          return m ? 'STANDARD' : null;
        }
      },
      {
        kind: 'SCHEDULE EXTRA HEAVY',
        match: (s) => {
          const m = s.match(/^((XH)|(XHB)|(EXTRA HEAVY))$/);
          return m ? 'EXTRA HEAVY' : null;
        }
      }
    ]
  },
  {
    kind: 'MATERIAL',
    matchers: [
      {
        kind: 'ASME STANDARD',
        match: (s) => {
          const m = s.match(/^(ASME B\d+\.?\d+?)$/);
          return m ? m[0] : null;
        }
      },
      {
        kind: 'STEEL TYPE',
        match: (s) => {
          const m = s.match(/^(?:FCS )?(S?A\d\d\dN?)$/);
          return m ? m[1] : null;
        }
      },
      {
        kind: 'CARBON STEEL',
        match: (s) => {
          const m = s.match(/^((CS)|(CARBON( STEEL)?))$/);
          return m ? 'CARBON STEEL' : null;
        }
      }
    ]
  }
];

interface ITokenMatch {
  spec_field_kind: string;
  field_match_kind: string;
  standardized_value: string;
}

interface ITokenMatchResult {
  token: string;
  matches: ITokenMatch[];
}

function parseToken(token: string): ITokenMatchResult {
  const result: ITokenMatchResult = {
    token,
    matches: []
  };
  for (const spec_field of SPECIFICATION) {
    for (const field_matcher of spec_field.matchers) {
      const value = field_matcher.match(token);
      if (value) {
        result.matches.push({
          spec_field_kind: spec_field.kind,
          field_match_kind: field_matcher.kind,
          standardized_value: value
        });
      }
    }
  }

  return result;
}

// First, break up the line by commas
// It's not this simple though... sometimes a single token
// contains a comma. So if a candidate token does not match
// any rule, see if it can be combined with its
// neighbors to make a match
function tokenizeLine(line: string): string[] {
  const result: string[] = [];
  const candidates = line.split(/, ?/).map(parseToken);
  for (let i = 0; i < candidates.length; i++) {
    // Add up to two next tokens if they combine to
    // create a match
    if (candidates.length - i >= 3) {
      const s = `${candidates[i].token} ${candidates[i + 1].token} ${candidates[i + 2].token}`; s
      if (parseToken(s).matches.length > 0) {
        console.log(s, parseToken(s).matches)
        result.push(s);
        i += 2;
        continue;
      }
    }

    if (candidates.length - i >= 2) {
      const s = `${candidates[i].token} ${candidates[i + 1].token}}`; s
      if (parseToken(s).matches.length > 0) {
        result.push(s);
        i += 1;
        continue;
      }
    }
    result.push(candidates[i].token);
  }


  return result;
}

function parseLine(line: string): ITokenMatchResult[] {
  return tokenizeLine(line).map(token => parseToken(token));
}

function getTestLines(): string[] {
  return [
    'PIPE, SCH STD, CS A-106B/A-53B/API 5L-B SMLS, P/D CODE PSA01 BBE, 3"',
    'FLG, RFSO, CL 150, SCH STD, FCS A105, ASME B16.5, P/D CODE FSA01, 20"',
    'FLG BLIND, RF,CL 150, FCS A105 ASME B16.5, 20"',
    'FLG, RFWN, CL 150, SCH STD, FCS A105 ASME B16.5, P/D CODE FWA01, 24"'
  ]
}

// specification field poplated with matched tokens and parsed values
interface IPopulatedSpecField {
  kind: string;
  matches: {
    kind: string,
    token: string,
    value: string
  }[];
}

// generate a list of spec fields populated with all the parsed tokens
// that matched them, as well as a special field for unmatched tokens
function populateSpecFields(match_results: ITokenMatchResult[]): IPopulatedSpecField[] {
  const result: IPopulatedSpecField[] = [];
  for (const spec_field of SPECIFICATION) {
    const new_field: IPopulatedSpecField = {
      kind: spec_field.kind,
      matches: []
    };
    for (const matches of match_results) {
      for (const match of matches.matches) {
        if (match.spec_field_kind == spec_field.kind) {
          new_field.matches.push({
            kind: match.field_match_kind,
            token: matches.token,
            value: match.standardized_value
          });
        }
      }
    }

    result.push(new_field);
  }

  // Extra field for unmatched tokens
  result.push({
    kind: 'UNRECOGNIZED',
    matches: match_results.filter(mr => mr.matches.length == 0).map(mr => ({
      kind: 'UNRECOGNIZED',
      token: mr.token,
      value: mr.token
    }))
  });

  return result;
}

export default function App() {
  const lines = getTestLines();
  const parsed_lines = lines.map(line => parseLine(line));

  // TODO: second pass parsing where we try to split unmatched
  // tokens by matching them to the patterns

  const populated_fields = parsed_lines.map(pl => populateSpecFields(pl));

  return (
    <main>
      <table className='blueTable'>
        <thead><tr>
          <th className='itemNumber'>#</th>
          <th>INPUT DATA</th>
        </tr></thead>
        <tbody>
          {lines.map((line, i) => <tr key={i}>
            <td className='itemNumber'>{i + 1}</td>
            <td>{line}</td>
          </tr>)}
        </tbody>
      </table>
      <table className='blueTable'>
        <thead><tr>
          <th className='itemNumber'>#</th>
          <th>TOKENIZATION</th>
        </tr></thead>
        <tbody>
          {parsed_lines.map((parsed_line, i) => <tr key={i}>
            <td className='itemNumber'>{i + 1}</td>
            <td>
              {parsed_line.map((token_matches, i) => <span className="token" key={i}>
                {token_matches.token}</span>)}
            </td>
          </tr>)}
        </tbody>
      </table>
      <table className='blueTable'>
        <thead>
          <tr>
            <th className='itemNumber'>#</th>
            {populated_fields[0].map((field, i) =>
              <th key={i}>{field.kind}</th>)}
          </tr>
        </thead>
        <tbody>
          {
            populated_fields.map((fields_row, i) => <tr key={i}>
              <td className='itemNumber'>{i + 1}</td>
              {
                fields_row.map((field, i) => <td key={i}>
                  {field.matches.map(match => match.value).join(" | ")}
                </td>)
              }
            </tr>)
          }
        </tbody>
      </table>
    </main>
  )
}
